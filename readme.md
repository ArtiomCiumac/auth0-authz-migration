# Authorization extension data migration tool

A helper tool to migrate auth0-authz extension data to user's app_metadata.

## Motivation

The current
[Authorization Extension](https://auth0.com/docs/extensions/authorization-extension/v2)
implementation stores all data in one file (either locally or in AWS S3).
Then this data is accessed via an API call from rules and used to enrich
user's profile with additional claims.

On high numbers of users (for example 100.000), the processing becomes slow
and this severely affects user's login experience.

This repository contains some helper functionality to improve the situation by
migrating role, group and permission data to user's app_metadata where it can
be accessed directly by the rule without additional HTTP API call.

The downside of this approach is that the user's app_metadata is updated with
a delay - so the solution may not be suitable as is for applications where
any authorization data updates have to happen immediately.

## Technical details

The migration is performed in 2 steps:

1. The initial data migration can be time consuming and should be run from a
   developer's machine.

2. Subsequent updates are performed from a cron task running every minute.

The output data is stored in user's `app_metadata` as `roles`, `groups` and
`permissions` fields. To make the data updates faster, the tool will save a
copy of Authorization Extension data to be used later to find what was
changed.

At this time, AWS S3 is the only supported storage, however any other storage
can be integrated easily. Note that both data versions are stored in the same
AWS S3 bucket.

The tool processes correctly the current implementaiton of
[Auth0 Rate Limiting](https://auth0.com/docs/policies/rate-limits) which is
the main reason to run the initial migration from a local engineer's computer,
as the process time is directly proportional to the number of API calls to
update user's data.

## Requirements

The tool was developed in Node.js v9.2.0, but should run fine in older versions
as long as they support lambda functions and the library dependencies listed in
`package.json`.

To configure and run the tool, an Auth0 tenant account is required with admin
access and an AWS S3 account for data storage.

In the Auth0 tenant, create a non-interactive client with access to Management
API, `read:users` and `update:users` scopes.

Running the update process as a webtask, requires locally installed and fully
set up [wt-cli](https://webtask.io/docs/wt-cli) tool.

## Running

Note that the first step (configuration) is mandatory, while the others can be
performed or skipped as necessary.

1. Configuration
   - Configure the non-interactive API client in the Auth0 tenant.
   - Obtain the required parameters of the AWS S3 storage bucket (see below).
   - Clone or download the project.
   - Run `npm install` to download all package dependencies.
   - In the project root createa file named `.env` with the following contents:
     ```
     S3_BUCKET=<AWS S3 bucket name to read and store the data, for exampple test-dev-authz>
     S3_KEY_NEW=<The path of the data file for Authorization Extension, for example: /auth0-authz.json>
     S3_KEY_OLD=<The path of the old data file for updates, for example: /auth0-authz-OLD.json>
     S3_KEY_ID=<AWS S3 Key ID>
     S3_SECRET=<AWS S3 Secret>
     A0_DOMAIN=<Auth0 tenant domain, for example: artex-dev.eu.auth0.com>
     A0_CLIENT_ID=<Auth0 Client ID to update user's data>
     A0_CLIENT_SECRET=<Auth0 Client secret to update user's data>
     ```

     This file will be loaded as tool configuration and will be used to
     provision the initial configuration of the webtask.


2. Running the migration step locally
   From the app folder, run the NPM task:
   ```
   npm run migrate-local
   ```

   The entry point is in the `migrate-local.js` file. The process can take 
   around 1.5 hours for 200.000 users.

3. Running the update step locally
   From the app folder, run the following NPM task:
   ```
   npm run update-local
   ```

   The entry point is in the `update-local.js` file. The process shuld be
   quick, depending on AWS S3 download/upload times and on the number of
   updated user accounts.

4. Running the update as webtask
   - Create the cron webtask (do this only once):
     ```
     npm run cron-create
     ```
     
     Note that the task will import its initial configuration from the `.env`
     file.

   - Open a separate terminal and run `wt logs` to watch the task running.
   - To update the task run:
     ```
     npm run cron-update
     ```

## Dependencies

The dependencies and their minimum tested versions are listed in `package.json`.
Note that for any new dependencies, one must ensure that they are present in
the webtask environment.

## References

* [Auth0 Non-interactive client](https://auth0.com/docs/clients/client-settings/non-interactive)
* [wt-cli](https://github.com/auth0/wt-cli)
* [Webtask cron](https://webtask.io/docs/cron)
* [Webtask packages](https://tehsis.github.io/webtaskio-canirequire/)