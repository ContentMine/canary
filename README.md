Canary
======

version 0.0.1

Canary is a controller for and user interface to other ContentMine tools - quickscrape, getpapers, norma, and AMI.

It is a node.js meteor app that uses mongodb for backend storage and can also send extracted facts to an elasticsearch index, either installed locally or by sending them remotely.

NOTE: this code remains at an early stage, and is not yet well structured (I was learning whilst building it). The next commit is likely to see quite a re-structuring and separation of configs etc now that I know node and meteor better.


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

At the top of the canary.js file there are various options that can be set. It is best to check directly there to ensure you are seeing the most up to date possibilities. But here is a rough overview:

Firstly there are some dir settings, to tell canary where to find various bits and pieces such as the scrapers for quickscrape, and to tell canary where to put the output files.

Then there are some url settings, to tell canary how to show links through to the storage from the UI (so this could be localhosted if you are running the system locally), and some URLs for where it should try to send facts and article metadata for elasticsearch indexing.

Next are the settings for what to run, such as runcron for running a daily extraction, and runlocal for running locally or not, and sendremote for whether or not to send extracted facts to a remote index of facts (by default our contentmine one). This is followed by some augmentations to the settings if runlocal is true, and a couple of remote URLs for sending facts and metadata remotely (again, our contentmine server).

Finally there is a setting for which processes should be available for running - this will depend on what AMI can support, and which ones you want to run. Put the names of the AMI processes you want to run into the availableProcesses setting.

