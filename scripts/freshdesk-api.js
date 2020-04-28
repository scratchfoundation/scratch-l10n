// interface to FreshDesk Solutions (knowledge base) api

const fetch = require('node-fetch');
class FreshdeskApi {

    constructor (baseUrl, apiKey) {
        this.baseUrl = baseUrl;
        this._auth = 'Basic ' + new Buffer(`${apiKey}:X`).toString('base64');
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Authorization': this._auth
        };
    }

    /**
     * Checks the status of a response. If status is not ok, or the body is not json raise exception
     * @param {object} res The response object
     * @returns {object} the response if it is ok
     */
    checkStatus (res) {
        if (res.ok) {
            if (res.headers.get('content-type').indexOf('application/json') !== -1) {
                return res;
            }
            throw new Error(`response not json: ${res.headers.get('content-type')}`);
        }
        throw new Error(`response: ${res.statusText}`);
    }

    listCategories () {
        return fetch(`${this.baseUrl}/api/v2/solutions/categories`, {headers: this.defaultHeaders})
            .then(this.checkStatus)
            .then(res => res.json());
    }

    listFolders (category) {
        return fetch(
            `${this.baseUrl}/api/v2/solutions/categories/${category.id}/folders`,
            {headers: this.defaultHeaders})
            .then(this.checkStatus)
            .then(res => res.json());
    }

    listArticles (folder) {
        return fetch(
            `${this.baseUrl}/api/v2/solutions/folders/${folder.id}/articles`,
            {headers: this.defaultHeaders})
            .then(this.checkStatus)
            .then(res => res.json());
    }
}

module.exports = FreshdeskApi;
