Canary
======

version 0.2.0

Canary is an API and daily runner for ContentMine.


Install
=======

First install all the other tools, see their repos on how to do so - quickscrape, getpapers, norma, AMI.

By installing quickscrape and getpapers you will have ensured you already have node installed.

Install meteor (https://www.meteor.com/install):

curl https://install.meteor.com/ | sh

Get the codebase:

git clone http://github.com/contentmine/canary

Run it:

cd canary

meteor

If you want to use a settings file, like the example one provided, and/or set the port to run on, run with a command like this:

meteor --port 3123 --settings settings.json

If you want to have your own index running, install elasticsearch too (https://www.elastic.co/)


Configure
=========

At the top of the canary.js file there are various options that can be set. It is best to check directly there to ensure 
you are seeing the most up to date possibilities.


Code Structure
==============

Canary is only a server-side app, even though it is written in meteor which can do server and client side. Externally, it exposes 
an API that can be connected to from remote services. 

The main code is in canary.js, which defines settings and the API endpoints. 

cron.js defines the daily jobs that run to retrieve and process articles on a daily basis, extracting facts and saving them to the 
index each day. The cron functions make use of the other functions, although the API can also call them directly in some cases, if 
necessary. 

index.js contains the code that can query and submit data to the elasticsearch indexes. 

normalise.js contains code that can do or that can execute normalisation to scholarly html. 

process.js can execute other processes on the article content to extract facts, for example by calling AMI. 

retrieve.js retrieves content from remote APIs and sites, via quickscrape / thresher / getpapers, or simply direct http requests to URLs.


Dictionaries
============

The extract section of the daily functions expects to be able to read a folder full of dictionary files. These SHOULD be JSON files named 
something like species.json and they should contain a JSON list of objects. Each object must have at least a "query" key, and that key 
should point to either a simple string to match exactly on, or a regex starting with /, or an object that is a full "query" part of an 
elasticsearch query.

It would also be possible to allow dictionaries in .xml and then convert them to the same structure, and also to allow .txt files that just 
contain a list of strings or regexes. However, neither of these capabilities have been added to the cron/extract function yet, althouth they 
easily could be.

When a fact is discovered, any keys present in the match object will be added to the fact, and the name of the dictionary file (without the 
filetype suffix) will be used to identify which dictionary matched the fact.







