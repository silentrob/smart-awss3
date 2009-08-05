awsS3 = {

    // Defeat caching with query params on GET requests?
    DEFEAT_CACHE: false,

    // Default ACL to use when uploading keys.
    DEFAULT_ACL: 'public-read',
    
    // Default content-type to use in uploading keys.
    DEFAULT_CONTENT_TYPE: 'text/plain',

    URL:        'http://s3.amazonaws.com',
    KEY_ID:     '',
    SECRET_KEY: '',


    // Flip this to true to potentially get lots of wonky logging.
    DEBUG: false,

    /**
        Get contents of a key in a bucket.
    */
    get: function(bucket, key) {
        return this.httpClient({
            method:   'GET',
            resource: '/' + bucket + '/' + key
        })
    },

    /**
        Head the meta of a key in a bucket.
    */
    head: function(bucket, key) {
        return this.httpClient({
            method:   'HEAD',
            resource: '/' + bucket + '/' + key
        })
    },

    /**
        Put data into a key in a bucket.
    */
    put: function(bucket, key, content) {

        // Process variable arguments for optional params.
        var idx = 3;
        var params = {};
        if (typeof arguments[idx] == 'object')
            params = arguments[idx++];
        var cb     = arguments[idx++];
        var err_cb = arguments[idx++];

        if (!params.content_type) 
            params.content_type = this.DEFAULT_CONTENT_TYPE;
        if (!params.acl)
            params.acl = this.DEFAULT_ACL;

        return this.httpClient({
            method:       'PUT',
            resource:     '/' + bucket + '/' + key,
            content:      content,
            content_type: params.content_type,
            meta:         params.meta,
            acl:          params.acl,
            load: function(req, obj) {
                if (cb)     return cb(req);
            },
            error: function(req, obj) {
                if (err_cb) return err_cb(req, obj);
                if (cb)     return cb(req, obj);
            }
        });
    },

    /**
        List buckets belonging to the account.
    */
    listBuckets: function() {
        return this.httpClient({ 
            method:'GET', resource:'/', 
            force_lists: [ 'Buckets.Bucket.Name' ]
        });
    },

    /**
        Create a new bucket for this account.
    */
    createBucket: function(bucket) {
        return this.httpClient({ 
            method:'PUT', resource:'/'+bucket
        });
    },

    /**
        Delete an empty bucket.
    */
    deleteBucket: function(bucket) {
        return this.httpClient({ 
            method:'DELETE', resource:'/'+bucket
        });
    },

    /**
        Given a bucket name and parameters, list keys in the bucket.
    */
    listKeys: function(bucket, params) {
        return this.httpClient({
            method:'GET', resource: '/'+bucket, 
            force_lists: [ 'Contents' ],
            params:params
        });
    },

    /**
        Delete a single key in a bucket.
    */
    deleteKey: function(bucket, key) {
        return this.httpClient({
            method:'DELETE', resource: '/'+bucket+'/'+key
        });
    },

    /**
        Delete a list of keys in a bucket, with optional callbacks
        for each deleted key and when list deletion is complete.
    */
    deleteKeys: function(bucket, list, one_cb, all_cb) {
        var _this = this;
        
        // If the list is empty, then fire off the callback.
        if (!list.length && all_cb) return all_cb();

        // Fire off key deletion with a callback to delete the 
        // next part of list.
        var key = list.shift();
        this.deleteKey(bucket, key, function() {
            if (one_cb) one_cb(key);
            _this.deleteKeys(bucket, list, one_cb, all_cb);
        });
    },

    /**
        Perform an authenticated S3 HTTP query.
    */
    httpClient: function(kwArgs) {
        
        var _this = this;
        
        // If need to defeat cache, toss in a date param on GET.
        if (this.DEFEAT_CACHE && ( kwArgs.method == "GET" || kwArgs.method == "HEAD" ) ) {
            if (!kwArgs.params) kwArgs.params = {};
            kwArgs.params["___"] = new Date().getTime();
        }

        // Prepare the query string and URL for this request.
        var qs   = (kwArgs.params) ? '?'+queryString(kwArgs.params) : '';
        var url  = this.URL + kwArgs.resource + qs;
        var hdrs = [];

        // Handle Content-Type header
        if (!kwArgs.content_type && kwArgs.method == 'PUT') 
            kwArgs.content_type = 'text/plain';
        if (kwArgs.content_type) {
            hdrs.push('Content-Type');
            hdrs.push(kwArgs.content_type);
        } else {
            kwArgs.content_type = '';
        }

        // Set the timestamp for this request.
        var http_date = this.httpDate();
        hdrs.push('Date');
        hdrs.push(http_date);
                
        var content_MD5 = '';
        /*
        // TODO: Fix this Content-MD5 stuff.
        if (kwArgs.content && kwArgs.content.hashMD5) {
            content_MD5 = kwArgs.content.hashMD5();
            hdrs['Content-MD5'] = content_MD5;
        }
        */

        // Handle the ACL parameter
        var acl_header_to_sign = '';
        if (kwArgs.acl) {
            hdrs['x-amz-acl'] = kwArgs.acl;
            acl_header_to_sign = "x-amz-acl:"+kwArgs.acl+"\n";
        }
        
        // Handle the metadata headers
        var meta_to_sign = '';
        if (kwArgs.meta) {
            for (var k in kwArgs.meta) {
                hdrs.push('x-amz-meta-'+k);
                hdrs.push(kwArgs.meta[k]);
                meta_to_sign += "x-amz-meta-"+k+":"+kwArgs.meta[k]+"\n";
            }
        }

        // Only perform authentication if non-anonymous and credentials available
        if (kwArgs['anonymous'] != true && this.KEY_ID && this.SECRET_KEY) {

            // Build the string to sign for authentication.
            var s; 
            s  = kwArgs.method + "\n";
            s += content_MD5 + "\n";
            s += kwArgs.content_type + "\n";
            s += http_date + "\n";
            s += acl_header_to_sign;
            s += meta_to_sign;
            s += kwArgs.resource;

            // Sign the string with our SECRET_KEY.
            var signature = this.hmacSHA1(s, this.SECRET_KEY);
            
            hdrs.push("Authorization")
            hdrs.push("AWS "+this.KEY_ID+":"+signature );
        }

    
        var req = system.http.request(kwArgs.method,url,hdrs);
        var db = new DebugConsole();
        system.console.log(db.processMessage(req));
                
//        req.obj = this.e4xToObj(req.content, kwArgs.force_lists);
        
        return req;
        
    },
    
    e4xToObj: function(s,force_lists) {
        
        s = s.replace(/^<\?xml\s+version\s*=\s*(["'])[^\1]+\1[^?]*\?>/, ""); // bug 336551
        s = s.replace('xmlns="http://s3.amazonaws.com/doc/2006-03-01/"','');
        var o = [];
        var xml = new XML(s);

        x = eval("xml." + force_lists);
        
        for (var i = 0; i < x.length(); i++ ) {
           o.push(x[i].text());
        }

        return o;
    },
    
    /**
        Abstract HMAC SHA1 signature calculation.
    */
    hmacSHA1: function(data, secret) {
        // TODO: Alternate Dojo implementation?
        return b64_hmac_sha1(secret, data)+'=';
    },
    
    /**
        Return a date formatted appropriately for HTTP Date header.
        Inspired by: http://www.svendtofte.com/code/date_format/

        TODO: Should some/all of this go into common.js?
    */
    httpDate: function(d) {
        // Use now as default date/time.
        if (!d) d = new Date();

        // Date abbreviations.
        var daysShort   = ["Sun", "Mon", "Tue", "Wed",
                           "Thu", "Fri", "Sat"];
        var monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        // See: http://www.quirksmode.org/js/introdate.html#sol
        function takeYear(theDate) {
            var x = theDate.getYear();
            var y = x % 100;
            y += (y < 38) ? 2000 : 1900;
            return y;
        };

        // Number padding function
        function zeropad(num, sz) { 
            return ( (sz - (""+num).length) > 0 ) ? 
                arguments.callee("0"+num, sz) : num; 
        };
        
        function gmtTZ(d) {
            // Difference to Greenwich time (GMT) in hours
            var os = Math.abs(d.getTimezoneOffset());
            var h = ""+Math.floor(os/60);
            var m = ""+(os%60);
            h.length == 1? h = "0"+h:1;
            m.length == 1? m = "0"+m:1;
            return d.getTimezoneOffset() < 0 ? "+"+h+m : "-"+h+m;
        };

        var s;
        s  = daysShort[d.getDay()] + ", ";
        s += d.getDate() + " ";
        s += monthsShort[d.getMonth()] + " ";
        s += takeYear(d) + " ";
        s += zeropad(d.getHours(), 2) + ":";
        s += zeropad(d.getMinutes(), 2) + ":";
        s += zeropad(d.getSeconds(), 2) + " ";
        s += gmtTZ(d);

        return s;
    },

    /* Help protect against errant end-commas */
    EOF: null

};

function queryString(params) {
    var l = [];
    for (k in params) 
        l.push(k+'='+encodeURIComponent(params[k]))
    return l.join("&");
}
