#!/bin/bash


export GIT_REPO_URL="$GIT_REPO_URL"

mkdir /home/app/output

git clone $GIT_REPO_URL /home/app/output

ls /home/app/output

exec node script.js