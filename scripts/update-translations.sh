#!/bin/bash

# script for syncing translations from transifex and comitting the changes.

git checkout master

npm run pull:editor

npm run test

git add .

git commit -m "pull new editor translations from Transifex"

git push
