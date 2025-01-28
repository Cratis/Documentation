#!/bin/bash
echo "Building TypeScript documentation..."

restore_paths=(
    "../ApplicationModel"
    "../Fundamentals"
)

# Define source and target paths
source_paths=(
    "../ApplicationModel/Source/JavaScript/Applications"
    "../ApplicationModel/Source/JavaScript/Applications.React"
    "../ApplicationModel/Source/JavaScript/Applications.React.MVVM"
    "../ApplicationModel/Source/JavaScript/Applications.Vite"
    "../Fundamentals/Source/JavaScript"
)

target_paths=(
    "./api/applicationmodel/javascript/applications"
    "./api/applicationmodel/javascript/applications.react"
    "./api/applicationmodel/javascript/applications.react.mvvm"
    "./api/applicationmodel/javascript/applications.vite"
    "./api/fundamentals/javascript"
)

for i in "${!restore_paths[@]}"; do
    restore_path="${restore_paths[$i]}"
    echo "Restoring packages in $restore_path..."
    pushd .
    cd "$restore_path"
    yarn install
    popd
done

for i in "${!source_paths[@]}"; do
    source_path="${source_paths[$i]}"
    target_path="${target_paths[$i]}"

    echo "Building documentation for $source_path"

    pushd .
    cd "$source_path"
    echo "Current directory: $(pwd)"
    yarn build
    popd
    yarn typedoc --plugin typedoc-plugin-markdown --hidePageHeader true --outputFileStrategy modules -out "$target_path" --tsconfig "$source_path/tsconfig.json" "$source_path/**/*.ts" --exclude "$source_path/dist/**/*" --exclude "$source_path/**/for_*/**/*" --exclude "$source_path/**/global.d.ts"
done

yarn fixts
