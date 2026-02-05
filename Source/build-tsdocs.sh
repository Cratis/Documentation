#!/bin/bash
echo "Building TypeScript documentation..."

restore_paths=(
    "../Arc"
    "../Fundamentals"
)

# Define source and target paths
source_paths=(
    "../Arc/Source/JavaScript/Arc"
    "../Arc/Source/JavaScript/Arc.React"
    "../Arc/Source/JavaScript/Arc.React.MVVM"
    "../Arc/Source/JavaScript/Arc.Vite"
    "../Fundamentals/Source/JavaScript"
)

target_paths=(
    "./api/arc/javascript/arc"
    "./api/arc/javascript/arc.react"
    "./api/arc/javascript/arc.react.mvvm"
    "./api/arc/javascript/arc.vite"
    "./api/fundamentals/javascript"
)

doc_names=(
    "Arc"
    "Arc.React"
    "Arc.React.MVVM"
    "Arc.Vite"
    "Fundamentals"
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
    doc_name="${doc_names[$i]}"

    echo "Building documentation for $source_path"

    pushd .
    cd "$source_path"
    echo "Current directory: $(pwd)"
    yarn build
    popd
    yarn typedoc --plugin typedoc-plugin-markdown --name "$doc_name" --hidePageHeader true --outputFileStrategy modules -out "$target_path" --tsconfig "$source_path/tsconfig.json" "$source_path/**/*.ts" --exclude "$source_path/dist/**/*" --exclude "$source_path/**/for_*/**/*" --exclude "$source_path/**/global.d.ts"
done

yarn fixts
