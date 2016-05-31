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

If you want to have your own index running, install elasticsearch too (https://www.elastic.co/)


Configure
=========

NOTE: this is all early stage, and not ideally setup for configuration...

At the top of the canary.js file there are various options that can be set. It is best to check directly there to ensure 
you are seeing the most up to date possibilities.


Code Structure
==============

Canary is only a server-side app, even though it is written in meteor which can do server and client side. Externally, it exposes 
an API that can be connected to from remote services. The main code is in canary.js, which defines settings, the API endpoints, and 
the daily cron activities. normalise.js contains code that can do or that can execute normalisation to scholarly html. process.js 
can execute other processes on the article content to extract facts, for example by calling AMI. retrieve.js retrieves content from 
remote APIs and sites, via quickscrape / thresher / getpapers, or simply direct http requests to URLs.


