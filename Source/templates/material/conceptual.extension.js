// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

const path = require('path');
const fs = require('fs');

/**
 * This method will be called at the start of exports.transform in conceptual.html.primary.js
 */
exports.preTransform = function (model) {
  return model;
}

/**
 * This method will be called at the end of exports.transform in conceptual.html.primary.js
 */
exports.postTransform = function (model) {
  // Check if the model has storybook configuration
  if (model.storybook && model.storybook.path) {
    model._storybookEnabled = true;
    
    // Calculate the relative path to the storybook build
    const storybookPath = model.storybook.path;
    let storybookBuildPath;
    
    if (storybookPath.startsWith('/')) {
      // Absolute path - relative to site root
      storybookBuildPath = storybookPath.substring(1) + '/storybook-static';
    } else {
      // Relative path - calculate from current page
      const currentPath = model._path || '';
      const currentDir = path.dirname(currentPath);
      storybookBuildPath = path.posix.join(currentDir, storybookPath, 'storybook-static');
    }
    
    model._storybookBuildPath = storybookBuildPath;
  }
  
  return model;
}

