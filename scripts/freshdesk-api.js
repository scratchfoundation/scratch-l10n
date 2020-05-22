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
        this.rateLimited = false;
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
        let err = new Error(`response ${res.statusText}`);
        err.code = res.status;
        if (res.status === 429) {
            err.retryAfter = res.headers.get('Retry-After');
        }
        throw err;
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

    updateCategoryTranslation (id, locale, body) {
        if (this.rateLimited) {
            process.stdout.write(`Rate limited, skipping id: ${id} for ${locale}\n`);
            return -1;
        }
        return fetch(
            `${this.baseUrl}/api/v2/solutions/categories/${id}/${locale}`,
            {
                method: 'put',
                body: JSON.stringify(body),
                headers: this.defaultHeaders
            })
            .then(this.checkStatus)
            .then(res => res.json())
            .catch((err) => {
                if (err.code === 404) {
                    // not found, try create instead
                    return fetch(
                        `${this.baseUrl}/api/v2/solutions/categories/${id}/${locale}`,
                        {
                            method: 'post',
                            body: JSON.stringify(body),
                            headers: this.defaultHeaders
                        })
                        .then(this.checkStatus)
                        .then(res => res.json());
                }
                if (err.code === 429) {
                    this.rateLimited = true;
                }
                process.stdout.write(`Error processing id ${id} for locale ${locale}: ${err.message}\n`);
                throw err;
            });
    }

    updateFolderTranslation (id, locale, body) {
        if (this.rateLimited) {
            process.stdout.write(`Rate limited, skipping id: ${id} for ${locale}\n`);
            return -1;
        }
        return fetch(
            `${this.baseUrl}/api/v2/solutions/folders/${id}/${locale}`,
            {
                method: 'put',
                body: JSON.stringify(body),
                headers: this.defaultHeaders
            })
            .then(this.checkStatus)
            .then(res => res.json())
            .catch((err) => {
                if (err.code === 404) {
                    // not found, try create instead
                    return fetch(
                        `${this.baseUrl}/api/v2/solutions/folders/${id}/${locale}`,
                        {
                            method: 'post',
                            body: JSON.stringify(body),
                            headers: this.defaultHeaders
                        })
                        .then(this.checkStatus)
                        .then(res => res.json());
                }
                if (err.code === 429) {
                    this.rateLimited = true;
                }
                process.stdout.write(`Error processing id ${id} for locale ${locale}: ${err.message}\n`);
                throw err;
            });
    }

    updateArticleTranslation (id, locale, body) {
        if (this.rateLimited) {
            process.stdout.write(`Rate limited, skipping id: ${id} for ${locale}\n`);
            return -1;
        }
        return fetch(
            `${this.baseUrl}/api/v2/solutions/articles/${id}/${locale}`,
            {
                method: 'put',
                body: JSON.stringify(body),
                headers: this.defaultHeaders
            })
            .then(this.checkStatus)
            .then(res => res.json())
            .catch((err) => {
                if (err.code === 404) {
                    // not found, try create instead
                    return fetch(
                        `${this.baseUrl}/api/v2/solutions/articles/${id}/${locale}`,
                        {
                            method: 'post',
                            body: JSON.stringify(body),
                            headers: this.defaultHeaders
                        })
                        .then(this.checkStatus)
                        .then(res => res.json());
                }
                if (err.code === 429) {
                    this.rateLimited = true;
                }
                process.stdout.write(`Error processing id ${id} for locale ${locale}: ${err.message}\n`);
                throw err;
            });
    }
}

module.exports = FreshdeskApi;
