const parseResponseData = async (response) => {
    if (response.status === 204 || response.status === 205) {
        return '';
    }
    const text = await response.text();
    if (text === '') {
        return '';
    }
    try {
        return JSON.parse(text);
    }
    catch (_error) {
        return text;
    }
};
const shouldEncodeJSON = (contentType, data) => typeof data !== 'string' && (!contentType || contentType.toLowerCase().includes('application/json'));
export const fetchRequest = async (url, method = 'GET', config = {}) => {
    const { data, headers: requestHeaders, ...requestInit } = config;
    const headers = new Headers(requestHeaders);
    const init = {
        method,
        headers,
        ...requestInit,
    };
    if (method !== 'GET' && method !== 'HEAD' && data !== undefined) {
        if (!headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }
        init.body = shouldEncodeJSON(headers.get('Content-Type'), data) ? JSON.stringify(data) : data;
    }
    const response = await fetch(url, init);
    const responseData = await parseResponseData(response);
    if (!response.ok) {
        const error = new Error(`${url} | ${String(responseData)} | ${response.status}`);
        error.response = {
            data: responseData,
            status: response.status,
        };
        throw error;
    }
    return {
        data: responseData,
        status: response.status,
    };
};
