# Smart AWSS3

An extension for the [smart platform](http://smart.joyent.com/) that gives you the ability to connect to [Amazon S3](http://aws.amazon.com/s3/).
This library was ported from S3Ajax.

## Install

Add smart-awss3 as a git submodule. In the root of your your smart project run:

    git submodule add git://github.com/silentrob/smart-awss3.git js/smart-awss3
    
**Or** if you would like to contribute back to smart-debug, fork the project and then install the submodule with your remote repo location:

    git submodule add git@github.com:<username>/smart-awss3.git js/smart-awss3
    
## Usage

In your `bootstrap.js` file tell your smart application to use smart-awss3:
    
    system.use("smart-awss3.init")
    
**Or** only require the helpers you want to use:
    
    system.use("smart-awss3.lib.debug")
    
## API
    awsS3.get()
    awsS3.head()
    awsS3.put()
    awsS3.listBuckets()
    awsS3.createBucket()    
    awsS3.deleteBucket()
    awsS3.listKeys()
    awsS3.deleteKeys()
    awsS3.deleteKey()
    awsS3.listKeys()    