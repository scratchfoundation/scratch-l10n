#!/bin/bash

# script for syncing translations from transifex and comitting the changes.

# exit script if any command returns a non-zero return code:
set -ev

npm run pull:editor
npm run pull:www
npm run test 

# commit any updates and push. Build and release should happen on the push not here.
git add .
git commit -m "pull new editor translations from Transifex"
git push https://${GITHUB_TOKEN}@github.com/${TRAVIS_REPO_SLUG}.git HEAD:master
