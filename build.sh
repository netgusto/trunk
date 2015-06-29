#!/usr/bin/env bash

FILES=./src/*.js

for f in $FILES
do
    filename=$(basename $f)
    echo "Compiling $filename"
    "./node_modules/babel/bin/babel/index.js" "$f" > "./dist/$filename"
done

