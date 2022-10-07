#!/usr/bin/env node

/**
 * @fileoverview
 * Script to upload a source en.json file to a particular transifex project resource.
 * Expects that the project and resource have already been defined in Transifex, and that
 * the person running the script has the the TX_TOKEN environment variable set to an api
 * token that has developer access.
 */

const fs = require('fs');
const path = require('path');
const {txPush, txCreateResource} = require('../lib/transifex.js');

const args = process.argv.slice(2);

const usage = `
Push English source strings to Transifex. Usage:
  node tx-push-src.js tx-project tx-resource english-json-file
      tx-project:        the project slug on transifex
      tx-resource:       the resource slug on transifex
      english-json-file: path to the en.json source
  NOTE: TX_TOKEN environment variable needs to be set with a Transifex API token. See
  the Localization page on the GUI wiki for information about setting up Transifex.
`;

// Exit if missing arguments or TX_TOKEN
if (args.length < 3 || !process.env.TX_TOKEN) {
    process.stdout.write(usage);
    process.exit(1);
}

// Globals
const PROJECT = args[0];
const RESOURCE = args[1];

let en = fs.readFileSync(path.resolve(args[2]));
en = JSON.parse(en);

// get the correct resource file type based on transifex project/repo and resource
const getResourceType = (project, resource) => {
    if (project === 'scratch-website') {
        // all the resources are KEYVALUEJSON
        return 'KEYVALUEJSON';
    }
    if (project === 'scratch-legacy') {
        // all the resources are po files
        return 'PO';
    }
    if (project === 'scratch-editor') {
        if (resource === 'blocks') {
            return 'KEYVALUEJSON';
        }
        // everything else is CHROME I18N JSON
        return 'CHROME';
    }
    if (project === 'scratch-videos') {
        // all the resources are srt files
        return 'SRT';
    }
    if (project === 'scratch-android') {
        // all the resources are android xml files
        return 'ANDROID';
    }
    if (project === 'scratch-resources') {
        // all the resources are Chrome format json files
        return 'CHROME';
    }
    process.stdout.write(`Error - Unknown resource type for:\n`);
    process.stdout.write(`  Project: ${project}, resource: ${resource}\n`);
    process.exit(1);
};

// update Transifex with English source
const pushSource = async function () {
    try {
        await txPush(PROJECT, RESOURCE, en);
    } catch (err) {
        if (err.statusCode !== 404) {
            process.stdout.write(`Transifex Error: ${err.message}\n`);
            process.stdout.write(
                `Transifex Error ${err.response.statusCode.toString()}: ${err.response.body}\n`);
            process.exitCode = 1;
            return;
        }
        // file not found - create it, but also give message
        process.stdout.write(`Transifex Resource not found, creating: ${RESOURCE}\n`);
        const resourceData = {
            slug: RESOURCE,
            name: RESOURCE,
            priority: 0, // default to normal priority
            i18nType: getResourceType(PROJECT, RESOURCE),
            content: en
        };
        await txCreateResource(PROJECT, resourceData);
        process.exitCode = 0;
    }
};

pushSource();
