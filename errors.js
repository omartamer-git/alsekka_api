const errors = {
    // data entry errors
    invalidemail: {error: '101'},
    invalidphone: {error: '102'},
    missinginfo: {error: '103'},
    incorrectlogin: {error: '104'},

    // query errors
    emailinuse: {error: '201'},
    phoneinuse: {error: '202'},

    // unexpected errors
    servererror: {error: '500'}
};

module.exports = errors;