const path = require('path');
const assert = require('yeoman-assert');
const helpers = require('yeoman-test');
const fse = require('fs-extra');
const sinon = require('sinon');
const ChildProcess = require('child_process');
const { jestExpect: expect } = require('mocha-expect-snapshot');

const constants = require('../generators/generator-constants');

const expectedFiles = {
  monolith: [
    'Procfile',
    `${constants.SERVER_MAIN_RES_DIR}/config/bootstrap-heroku.yml`,
    `${constants.SERVER_MAIN_RES_DIR}/config/application-heroku.yml`,
  ],
};

describe('JHipster Heroku Sub Generator', () => {
  const herokuAppName = 'jhipster-test';
  let stub;

  beforeEach(() => {
    stub = sinon.stub(ChildProcess, 'exec');
    stub.withArgs('heroku --version').yields(false);
    stub.withArgs('heroku plugins').yields(false, 'heroku-cli-deploy');
    stub.withArgs('git init').yields([false, '', '']);
  });
  afterEach(() => {
    ChildProcess.exec.restore();
  });

  describe('microservice application', () => {
    describe('with JAR deployment', () => {
      let runResult;
      beforeEach(async () => {
        stub.withArgs(`heroku create ${herokuAppName}`).yields(false, '', '');
        stub.withArgs(`heroku addons:create jawsdb:kitefin --as DATABASE --app ${herokuAppName}`).yields(false, '', '');
        stub
          .withArgs(`heroku config:set JHIPSTER_REGISTRY_URL=https://admin:changeme@sushi.herokuapp.com --app ${herokuAppName}`)
          .yields(false, '', '')
          .returns({
            stdout: {
              on: () => {},
            },
          });
        runResult = await helpers
          .create(require.resolve('../generators/heroku'))
          .inTmpDir(dir => {
            fse.copySync(path.join(__dirname, './templates/default-microservice/'), dir);
          })
          .withOptions({ skipBuild: true, reproducibleTests: true })
          .withPrompts({
            herokuAppName,
            herokuRegion: 'us',
            herokuDeployType: 'jar',
            herokuJHipsterRegistryApp: 'sushi',
            herokuJHipsterRegistryUsername: 'admin',
            herokuJHipsterRegistryPassword: 'changeme',
            herokuJavaVersion: '11',
            useOkta: false,
          })
          .run();
      });
      it('should match files snapshot', function () {
        expect(runResult.getSnapshot()).toMatchSnapshot();
      });
      it('creates expected files', () => {
        assert.fileContent('.yo-rc.json', '"herokuDeployType": "jar"');
      });
    });
  });

  describe('monolith application', () => {
    describe('with an unavailable app name', () => {
      const autogeneratedAppName = 'jhipster-new-name';
      let runResult;
      beforeEach(async () => {
        stub
          .withArgs(`heroku create ${herokuAppName}`)
          .yields(true, '', `Name ${herokuAppName} is already taken`)
          .returns({
            stdout: {
              on: () => {},
            },
          });
        stub.withArgs('heroku create ').yields(false, `https://${autogeneratedAppName}.herokuapp.com`);
        stub.withArgs(`heroku git:remote --app ${autogeneratedAppName}`).yields(false, `https://${autogeneratedAppName}.herokuapp.com`);
        stub.withArgs(`heroku addons:create jawsdb:kitefin --as DATABASE --app ${autogeneratedAppName}`).yields(false, '', '');
        runResult = await helpers
          .create(require.resolve('../generators/heroku'))
          .inTmpDir(dir => {
            fse.copySync(path.join(__dirname, './templates/default'), dir);
          })
          .withOptions({ skipBuild: true, reproducibleTests: true })
          .withPrompts({
            herokuAppName,
            herokuRegion: 'us',
            herokuDeployType: 'jar',
            herokuForceName: 'No',
            herokuJavaVersion: '11',
            useOkta: false,
          })
          .run();
      });
      it('should match files snapshot', function () {
        expect(runResult.getSnapshot()).toMatchSnapshot();
      });
      it('creates expected monolith files', () => {
        assert.file(expectedFiles.monolith);
        assert.fileContent('.yo-rc.json', `"herokuAppName": "${autogeneratedAppName}"`);
      });
    });

    describe('with Git deployment', () => {
      let runResult;
      beforeEach(async () => {
        stub.withArgs(`heroku create ${herokuAppName}`).yields(false, '', '');
        stub.withArgs(`heroku addons:create jawsdb:kitefin --as DATABASE --app ${herokuAppName}`).yields(false, '', '');
        stub.withArgs('git add .').yields(false, '', '');
        stub.withArgs('git commit -m "Deploy to Heroku" --allow-empty').yields(false, '', '');
        stub.withArgs(`heroku config:set MAVEN_CUSTOM_OPTS="-Pprod,heroku -DskipTests" --app ${herokuAppName}`).yields(false, '', '');
        stub.withArgs(`heroku buildpacks:add heroku/java --app ${herokuAppName}`).yields(false, '', '');
        stub.withArgs('git push heroku HEAD:master').yields(false, '', '');
        runResult = await helpers
          .create(require.resolve('../generators/heroku'))
          .inTmpDir(dir => {
            fse.copySync(path.join(__dirname, './templates/default'), dir);
          })
          .withPrompts({
            herokuAppName,
            herokuRegion: 'us',
            herokuDeployType: 'git',
            herokuJavaVersion: '11',
            useOkta: false,
          })
          .run();
      });
      it('should match files snapshot', function () {
        expect(runResult.getSnapshot()).toMatchSnapshot();
      });
      it('creates expected monolith files', () => {
        assert.file(expectedFiles.monolith);
        assert.fileContent('.yo-rc.json', '"herokuDeployType": "git"');
      });
    });

    describe('in the US', () => {
      let runResult;
      beforeEach(async () => {
        stub.withArgs(`heroku create ${herokuAppName}`).yields(false, '', '');
        stub.withArgs(`heroku addons:create jawsdb:kitefin --as DATABASE --app ${herokuAppName}`).yields(false, '', '');
        runResult = await helpers
          .create(require.resolve('../generators/heroku'))
          .inTmpDir(dir => {
            fse.copySync(path.join(__dirname, './templates/default/'), dir);
          })
          .withOptions({ skipBuild: true, reproducibleTests: true })
          .withPrompts({
            herokuAppName,
            herokuRegion: 'us',
            herokuDeployType: 'jar',
            herokuJavaVersion: '11',
            useOkta: false,
          })
          .run();
      });
      it('should match files snapshot', function () {
        expect(runResult.getSnapshot()).toMatchSnapshot();
      });
      it('creates expected monolith files', () => {
        assert.file(expectedFiles.monolith);
        assert.fileContent('.yo-rc.json', '"herokuDeployType": "jar"');
        assert.fileContent(`${constants.SERVER_MAIN_RES_DIR}/config/application-heroku.yml`, 'datasource:');
        assert.noFileContent(`${constants.SERVER_MAIN_RES_DIR}/config/application-heroku.yml`, 'mongodb:');
      });
    });

    describe('in the EU', () => {
      let runResult;
      beforeEach(async () => {
        stub.withArgs(`heroku create ${herokuAppName} --region eu`).yields(false, '', '');
        stub.withArgs(`heroku addons:create jawsdb:kitefin --as DATABASE --app ${herokuAppName}`).yields(false, '', '');
        runResult = await helpers
          .create(require.resolve('../generators/heroku'))
          .inTmpDir(dir => {
            fse.copySync(path.join(__dirname, './templates/default/'), dir);
          })
          .withOptions({ skipBuild: true, reproducibleTests: true })
          .withPrompts({
            herokuAppName,
            herokuRegion: 'eu',
            herokuDeployType: 'jar',
            herokuJavaVersion: '11',
            useOkta: false,
          })
          .run();
      });
      it('should match files snapshot', function () {
        expect(runResult.getSnapshot()).toMatchSnapshot();
      });
      it('creates expected monolith files', () => {
        assert.file(expectedFiles.monolith);
      });
    });

    describe('with PostgreSQL', () => {
      let runResult;
      beforeEach(async () => {
        stub.withArgs(`heroku create ${herokuAppName} --region eu`).yields(false, '', '');
        stub.withArgs(`heroku addons:create heroku-postgresql --as DATABASE --app ${herokuAppName}`).yields(false, '', '');
        runResult = await helpers
          .create(require.resolve('../generators/heroku'))
          .inTmpDir(dir => {
            fse.copySync(path.join(__dirname, './templates/default-psql/'), dir);
          })
          .withOptions({ skipBuild: true, reproducibleTests: true })
          .withPrompts({
            herokuAppName,
            herokuRegion: 'eu',
            herokuDeployType: 'jar',
            herokuJavaVersion: '11',
            useOkta: false,
          })
          .run();
      });
      it('should match files snapshot', function () {
        expect(runResult.getSnapshot()).toMatchSnapshot();
      });
      it('creates expected monolith files', () => {
        assert.file(expectedFiles.monolith);
        assert.fileContent(`${constants.SERVER_MAIN_RES_DIR}/config/application-heroku.yml`, 'datasource:');
        assert.noFileContent(`${constants.SERVER_MAIN_RES_DIR}/config/application-heroku.yml`, 'mongodb:');
      });
    });

    describe('with existing app', () => {
      const existingHerokuAppName = 'jhipster-existing';
      let runResult;
      beforeEach(async () => {
        stub
          .withArgs(`heroku apps:info --json ${existingHerokuAppName}`)
          .yields(false, `{"app":{"name":"${existingHerokuAppName}"}, "dynos":[]}`);
        stub.withArgs(`heroku addons:create jawsdb:kitefin --as DATABASE --app ${existingHerokuAppName}`).yields(false, '', '');
        runResult = await helpers
          .create(require.resolve('../generators/heroku'))
          .inTmpDir(dir => {
            fse.copySync(path.join(__dirname, './templates/heroku/'), dir);
          })
          .withOptions({ skipBuild: true, reproducibleTests: true })
          .run();
      });
      it('should match files snapshot', function () {
        expect(runResult.getSnapshot()).toMatchSnapshot();
      });
      it('creates expected monolith files', () => {
        assert.file(expectedFiles.monolith);
        assert.fileContent('.yo-rc.json', `"herokuAppName": "${existingHerokuAppName}"`);
      });
    });

    describe('with elasticsearch', () => {
      let runResult;
      beforeEach(async () => {
        stub.withArgs(`heroku create ${herokuAppName}`).yields(false, '', '');
        stub.withArgs(`heroku addons:create jawsdb:kitefin --as DATABASE --app ${herokuAppName}`).yields(false, '', '');
        stub.withArgs(`heroku addons:create bonsai --as BONSAI --app ${herokuAppName}`).yields(false, '', '');

        runResult = await helpers
          .create(require.resolve('../generators/heroku'))
          .inTmpDir(dir => {
            fse.copySync(path.join(__dirname, './templates/default-elasticsearch/'), dir);
          })
          .withOptions({ skipBuild: true, reproducibleTests: true })
          .withPrompts({
            herokuAppName,
            herokuRegion: 'us',
            herokuDeployType: 'jar',
            herokuJavaVersion: '11',
            useOkta: false,
          })
          .run();
      });
      it('should match files snapshot', function () {
        expect(runResult.getSnapshot()).toMatchSnapshot();
      });
      it('creates expected monolith files', () => {
        assert.file(expectedFiles.monolith);
        assert.fileContent('.yo-rc.json', '"herokuDeployType": "jar"');
        assert.fileContent(`${constants.SERVER_MAIN_RES_DIR}/config/application-heroku.yml`, 'datasource:');
        assert.noFileContent(`${constants.SERVER_MAIN_RES_DIR}/config/application-heroku.yml`, 'mongodb:');
      });
    });
  });
});
