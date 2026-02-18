/**
 * Storybook Theme Synchronization Helper
 * 
 * This file should be imported in your Storybook's .storybook/preview.js
 * to enable automatic theme synchronization with the documentation site.
 * 
 * Usage in .storybook/preview.js:
 * 
 * import { addons } from '@storybook/preview-api';
 * 
 * // Listen for theme changes from parent documentation site
 * window.addEventListener('message', (event) => {
 *   if (event.data.type === 'STORYBOOK_THEME_CHANGE') {
 *     const channel = addons.getChannel();
 *     channel.emit('DARK_MODE', event.data.theme === 'dark');
 *   }
 * });
 * 
 * Or if using @storybook/addon-themes:
 * 
 * window.addEventListener('message', (event) => {
 *   if (event.data.type === 'STORYBOOK_THEME_CHANGE') {
 *     const channel = addons.getChannel();
 *     channel.emit('updateGlobals', {
 *       globals: { theme: event.data.theme }
 *     });
 *   }
 * });
 */

// This is a standalone version that can be loaded directly
(function() {
  'use strict';
  
  window.addEventListener('message', function(event) {
    if (event.data.type === 'STORYBOOK_THEME_CHANGE') {
      const theme = event.data.theme;
      
      // Try different methods to set the theme
      try {
        // Method 1: Using Storybook addons channel
        if (window.__STORYBOOK_ADDONS_CHANNEL) {
          const channel = window.__STORYBOOK_ADDONS_CHANNEL;
          
          // For @storybook/addon-themes
          channel.emit('updateGlobals', {
            globals: { theme: theme }
          });
          
          // For dark mode addon
          channel.emit('DARK_MODE', theme === 'dark');
        }
        
        // Method 2: Update CSS class on body
        if (theme === 'dark') {
          document.body.classList.add('dark-mode', 'dark');
          document.body.classList.remove('light-mode', 'light');
        } else {
          document.body.classList.add('light-mode', 'light');
          document.body.classList.remove('dark-mode', 'dark');
        }
        
        // Method 3: Update data attribute
        document.documentElement.setAttribute('data-theme', theme);
        
        console.log('Storybook theme updated to:', theme);
      } catch (error) {
        console.error('Error updating Storybook theme:', error);
      }
    }
  });
  
  console.log('Storybook theme synchronization listener initialized');
})();
