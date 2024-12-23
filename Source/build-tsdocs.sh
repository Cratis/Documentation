#!/bin/bash
echo "Building TypeScript documentation..."

# Define source and target paths
source_paths=(
    "../ApplicationModel/Source/JavaScript/Applications"
    "../ApplicationModel/Source/JavaScript/Applications.React"
    "../ApplicationModel/Source/JavaScript/Applications.React.MVVM"
    "../ApplicationModel/Source/JavaScript/Applications.Vite"
)

target_paths=(
    "./api/applicationmodel/javascript/applications"
    "./api/applicationmodel/javascript/applications.react"
    "./api/applicationmodel/javascript/applications.react.mvvm"
    "./api/applicationmodel/javascript/applications.vite"
)

# Loop through the arrays
for i in "${!source_paths[@]}"; do
    source_path="${source_paths[$i]}"
    target_path="${target_paths[$i]}"

    pushd .
    cd "$source_path"
    yarn build
    popd
    yarn typedoc --plugin typedoc-plugin-markdown -out "$target_path" --tsconfig "$source_path/tsconfig.json" "$source_path/**/*.ts"
done
