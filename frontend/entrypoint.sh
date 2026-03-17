#!/bin/sh
set -e
cp /usr/share/nginx/html/config.json.template /usr/share/nginx/html/config.json
exec nginx -g 'daemon off;'
