#!/usr/bin/env bash
# Create a standalone SwiftUI app from this starter: new-app.sh <Name> [dest folder]
# <Name> is PascalCase (letters and digits), e.g. ClipShelf. The app lands in <dest>/<Name>.
set -euo pipefail
name="${1:?usage: new-app.sh <Name> [dest]}"
dest="${2:-$PWD}"
[[ "$name" =~ ^[A-Z][A-Za-z0-9]*$ ]] || { echo "Name must be PascalCase letters and digits: $name" >&2; exit 1; }
here="$(cd "$(dirname "$0")" && pwd)"
dir="$dest/$name"
[[ ! -e "$dir" || -z "$(ls -A "$dir")" ]] || { echo "$dir already exists and is not empty" >&2; exit 1; }

mkdir -p "$dir"
cp -R "$here/Package.swift" "$here/bundle.sh" "$here/.gitignore" "$here/.swift-format" "$here/Sources" "$dir/"
mv "$dir/Sources/Starter" "$dir/Sources/$name"
mv "$dir/Sources/$name/StarterApp.swift" "$dir/Sources/$name/${name}App.swift"
lower="$(echo "$name" | tr '[:upper:]' '[:lower:]')"
grep -rl 'Starter\|com\.example\.starter' "$dir" | while read -r f; do
    sed -i '' -e "s/com\.example\.starter/com.example.$lower/g" -e "s/Starter/$name/g" "$f"
done
chmod +x "$dir/bundle.sh"
echo "$dir"
