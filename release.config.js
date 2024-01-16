module.exports = {
    extends: 'scratch-semantic-release-config',
    branches: [
        {
            name: 'master'
            // default channel
        },
        {
            name: 'hotfix/*',
            channel: 'hotfix',
            prerelease: 'hotfix'
        }
    ]
};
