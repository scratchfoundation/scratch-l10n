#!/bin/bash

# script for syncing translations from transifex and comitting the changes.
# exit if either the pulls or the test fail

npm run pull:editor
rc=$?; if [[ $rc != 0 ]]; then exit $rc; fi
npm run test
rc=$?; if [[ $rc != 0 ]]; then exit $rc; fi
git add .

git commit -m "pull new editor translations from Transifex"

git push
