#!/bin/bash

mkdir -p output
rm -rf output/*

npm run package-update

pushd src
cp -af package.json ../output/
babel -d ../output *.js desktop/**/*.js
popd
