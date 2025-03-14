/**
 * Copyright 2013-2022 the original author or authors from the JHipster project.
 *
 * This file is part of the JHipster project, see https://www.jhipster.tech/
 * for more information.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-disable consistent-return */
const chalk = require('chalk');
const _ = require('lodash');

const BaseApplicationGenerator = require('../base-application/generator.cjs');

const prompts = require('./prompts');
const { cleanup: cleanupAngular, writeFiles: writeAngularFiles } = require('./files-angular');
const { cleanup: cleanupReact, writeFiles: writeReactFiles } = require('./files-react');
const { cleanup: cleanupVue, writeFiles: writeVueFiles } = require('./files-vue');
const writeCommonFiles = require('./files-common').writeFiles;
const { clientI18nFiles } = require('../languages/files');

const packagejs = require('../../package.json');
const constants = require('../generator-constants');
const statistics = require('../statistics');
const { clientDefaultConfig } = require('../generator-defaults');
const { GENERATOR_CYPRESS, GENERATOR_COMMON, GENERATOR_LANGUAGES, GENERATOR_CLIENT } = require('../generator-list');

const { ANGULAR } = constants.SUPPORTED_CLIENT_FRAMEWORKS;
const { CYPRESS } = require('../../jdl/jhipster/test-framework-types');
const { OAUTH2 } = require('../../jdl/jhipster/authentication-types');
const databaseTypes = require('../../jdl/jhipster/database-types');

const NO_DATABASE = databaseTypes.NO;
const { CommonDBTypes } = require('../../jdl/jhipster/field-types');
const { GENERATOR_BOOTSTRAP_APPLICATION } = require('../generator-list');

const TYPE_STRING = CommonDBTypes.STRING;
const TYPE_UUID = CommonDBTypes.UUID;

/**
 * @class
 * @extends {BaseApplicationGenerator<import('../bootstrap-application-client/types').ClientApplication>}
 */
module.exports = class JHipsterClientGenerator extends BaseApplicationGenerator {
  constructor(args, options, features) {
    super(args, options, { unique: 'namespace', ...features });

    // This adds support for a `--auth` flag
    this.option('auth', {
      desc: 'Provide authentication type for the application',
      type: String,
    });

    // This adds support for a `--skip-commit-hook` flag
    this.option('skip-commit-hook', {
      desc: 'Skip adding husky commit hooks',
      type: Boolean,
    });

    // This adds support for a `--experimental` flag which can be used to enable experimental features
    this.option('experimental', {
      desc: 'Enable experimental features. Please note that these features may be unstable and may undergo breaking changes at any time',
      type: Boolean,
    });

    if (this.options.help) {
      return;
    }

    this.loadStoredAppOptions();
    this.loadRuntimeOptions();

    this.existingProject = !!this.jhipsterConfig.clientFramework;
  }

  async _postConstruct() {
    // TODO depend on GENERATOR_BOOTSTRAP_APPLICATION_CLIENT.
    await this.dependsOnJHipster(GENERATOR_BOOTSTRAP_APPLICATION);
    if (!this.fromBlueprint) {
      await this.composeWithBlueprints(GENERATOR_CLIENT);
    }
  }

  get initializing() {
    return this.asInitialingTaskGroup({
      validateFromCli() {
        this.checkInvocationFromCLI();
      },

      setupConstants() {
        // Make constants available in templates
        this.packagejs = packagejs;
      },

      displayLogo() {
        if (this.logo) {
          this.printJHipsterLogo();
        }
      },
    });
  }

  get [BaseApplicationGenerator.INITIALIZING]() {
    return this.asInitialingTaskGroup(this.delegateToBlueprint ? {} : this.initializing);
  }

  get prompting() {
    return this.asPromptingTaskGroup({
      askForModuleName: prompts.askForModuleName,
      askForClient: prompts.askForClient,
      askForAdminUi: prompts.askForAdminUi,
      askForClientTheme: prompts.askForClientTheme,
      askForClientThemeVariant: prompts.askForClientThemeVariant,
    });
  }

  get [BaseApplicationGenerator.PROMPTING]() {
    return this.asPromptingTaskGroup(this.delegateToBlueprint ? {} : this.prompting);
  }

  get configuring() {
    return this.asConfiguringTaskGroup({
      configureDevServerPort() {
        this.devServerBasePort = this.jhipsterConfig.clientFramework === ANGULAR ? 4200 : 9060;

        if (this.jhipsterConfig.devServerBasePort !== undefined) return undefined;
        let devServerPort;

        if (this.jhipsterConfig.applicationIndex !== undefined) {
          devServerPort = this.devServerBasePort + this.jhipsterConfig.applicationIndex;
        } else if (!this.devServerPort) {
          devServerPort = this.devServerBasePort;
        }

        this.jhipsterConfig.devServerPort = devServerPort;
      },

      upgradeAngular() {
        if (this.jhipsterConfig.clientFramework === 'angularX') {
          this.jhipsterConfig.clientFramework = ANGULAR;
        }
      },

      saveConfig() {
        this.setConfigDefaults(clientDefaultConfig);
      },
    });
  }

  get [BaseApplicationGenerator.CONFIGURING]() {
    return this.asConfiguringTaskGroup(this.delegateToBlueprint ? {} : this.configuring);
  }

  get composing() {
    return this.asComposingTaskGroup({
      async composeCommon() {
        await this.composeWithJHipster(GENERATOR_COMMON, true);
      },
      async composeCypress() {
        const testFrameworks = this.jhipsterConfig.testFrameworks;
        if (!Array.isArray(testFrameworks) || !testFrameworks.includes(CYPRESS)) return;
        await this.composeWithJHipster(GENERATOR_CYPRESS, { existingProject: this.existingProject }, true);
      },
      async composeLanguages() {
        // We don't expose client/server to cli, composing with languages is used for test purposes.
        if (this.jhipsterConfig.enableTranslation === false) return;

        await this.composeWithJHipster(GENERATOR_LANGUAGES, true);
      },
    });
  }

  get [BaseApplicationGenerator.COMPOSING]() {
    return this.asComposingTaskGroup(this.delegateToBlueprint ? {} : this.composing);
  }

  get loading() {
    return this.asLoadingTaskGroup({
      configureGlobal({ application }) {
        // Make constants available in templates
        application.MAIN_SRC_DIR = this.CLIENT_MAIN_SRC_DIR;
        application.TEST_SRC_DIR = this.CLIENT_TEST_SRC_DIR;
        this.packagejs = packagejs;
      },

      loadSharedConfig({ application }) {
        // TODO v8 rename to nodePackageManager;
        application.clientPackageManager = 'npm';
      },

      loadPackageJson({ application }) {
        // Load common client package.json into packageJson
        _.merge(
          this.dependabotPackageJson,
          this.fs.readJSON(this.fetchFromInstalledJHipster('client', 'templates', 'common', 'package.json'))
        );
        // Load client package.json into packageJson
        const clientFramewok = application.clientFramework;
        _.merge(
          this.dependabotPackageJson,
          this.fs.readJSON(this.fetchFromInstalledJHipster('client', 'templates', clientFramewok, 'package.json'))
        );
      },
    });
  }

  get [BaseApplicationGenerator.LOADING]() {
    return this.asLoadingTaskGroup(this.delegateToBlueprint ? {} : this.loading);
  }

  // Public API method used by the getter and also by Blueprints
  get preparing() {
    return this.asPreparingTaskGroup({
      microservice({ application }) {
        if (application.applicationTypeMicroservice) {
          application.withAdminUi = false;
        }
      },

      prepareForTemplates({ application }) {
        // Make dist dir available in templates
        application.BUILD_DIR = this.getBuildDirectoryForBuildTool(application.buildTool);

        application.DIST_DIR = this.getResourceBuildDirectoryForBuildTool(application.buildTool) + constants.CLIENT_DIST_DIR;
        application.MAIN_SRC_DIR = this.CLIENT_MAIN_SRC_DIR;
        application.TEST_SRC_DIR = this.CLIENT_TEST_SRC_DIR;
        application.webappLoginRegExp = constants.LOGIN_REGEX_JS;
        application.NODE_VERSION = constants.NODE_VERSION;

        if (application.authenticationType === OAUTH2 || application.databaseType === NO_DATABASE) {
          application.skipUserManagement = true;
        }
      },

      async loadNativeLanguage({ application }) {
        if (!application.baseName) return;
        const context = { ...application };
        await this._loadClientTranslations(context);
      },
    });
  }

  get [BaseApplicationGenerator.PREPARING]() {
    return this.asPreparingTaskGroup(this.delegateToBlueprint ? {} : this.preparing);
  }

  // Public API method used by the getter and also by Blueprints
  get default() {
    return this.asDefaultTaskGroup({
      loadUserManagementEntities({ application }) {
        if (application.user) {
          application.userPrimaryKeyTypeString = application.user.primaryKey.type === TYPE_STRING;
          application.userPrimaryKeyTypeUUID = application.user.primaryKey.type === TYPE_UUID;
        }
      },

      loadEntities() {
        const entities = this.sharedData.getEntities().map(({ entity }) => entity);
        this.localEntities = entities.filter(entity => !entity.builtIn && !entity.skipClient);
      },

      insight({ application }) {
        statistics.sendSubGenEvent('generator', GENERATOR_CLIENT, {
          app: {
            clientFramework: application.clientFramework,
            enableTranslation: application.enableTranslation,
            nativeLanguage: application.nativeLanguage,
            languages: application.languages,
          },
        });
      },
    });
  }

  get [BaseApplicationGenerator.DEFAULT]() {
    return this.asDefaultTaskGroup(this.delegateToBlueprint ? {} : this.default);
  }

  // Public API method used by the getter and also by Blueprints
  get writing() {
    return this.asWritingTaskGroup({
      webappFakeDataSeed({ application: { clientFramework } }) {
        this.resetEntitiesFakeData(clientFramework);
      },
      cleanupAngular,
      writeAngularFiles,
      cleanupReact,
      writeReactFiles,
      cleanupVue,
      writeVueFiles,
      writeCommonFiles,
    });
  }

  get [BaseApplicationGenerator.WRITING]() {
    return this.asWritingTaskGroup(this.delegateToBlueprint ? {} : this.writing);
  }

  get postWriting() {
    return this.asPostWritingTaskGroup({
      packageJsonScripts({ application }) {
        const packageJsonStorage = this.createStorage('package.json');
        const scriptsStorage = packageJsonStorage.createStorage('scripts');

        const packageJsonConfigStorage = packageJsonStorage.createStorage('config').createProxy();
        if (process.env.JHI_PROFILE) {
          packageJsonConfigStorage.default_environment = process.env.JHI_PROFILE.includes('dev') ? 'dev' : 'prod';
        }

        const devDependencies = packageJsonStorage.createStorage('devDependencies');
        devDependencies.set('wait-on', this.dependabotPackageJson.devDependencies['wait-on']);
        devDependencies.set('concurrently', this.dependabotPackageJson.devDependencies.concurrently);

        if (application.clientFrameworkReact) {
          scriptsStorage.set('ci:frontend:test', 'npm run webapp:build:$npm_package_config_default_environment && npm run test-ci');
        } else {
          scriptsStorage.set('ci:frontend:build', 'npm run webapp:build:$npm_package_config_default_environment');
          scriptsStorage.set('ci:frontend:test', 'npm run ci:frontend:build && npm test');
        }
      },

      microfrontend({ application }) {
        if (!application.microfrontend) return;
        if (application.clientFrameworkAngular) {
          const conditional = application.applicationTypeMicroservice ? "targetOptions.target === 'serve' ? {} : " : '';
          this.addWebpackConfig(
            `${conditional}require('./webpack.microfrontend')(config, options, targetOptions)`,
            application.clientFramework
          );
        } else if (application.clientFrameworkVue || application.clientFrameworkReact) {
          this.addWebpackConfig("require('./webpack.microfrontend')({ serve: options.env.WEBPACK_SERVE })", application.clientFramework);
        } else {
          throw new Error(`Client framework ${application.clientFramework} doesn't support microfrontends`);
        }
      },
    });
  }

  get [BaseApplicationGenerator.POST_WRITING]() {
    return this.asPostWritingTaskGroup(this.delegateToBlueprint ? {} : this.postWriting);
  }

  // Public API method used by the getter and also by Blueprints
  get end() {
    return this.asEndTaskGroup({
      end({ application }) {
        this.log(chalk.green.bold('\nClient application generated successfully.\n'));

        const logMsg = `Start your Webpack development server with:\n ${chalk.yellow.bold(`${application.clientPackageManager} start`)}\n`;

        this.log(chalk.green(logMsg));
      },
    });
  }

  get [BaseApplicationGenerator.END]() {
    return this.asEndTaskGroup(this.delegateToBlueprint ? {} : this.end);
  }

  /**
   * @experimental
   * Load client native translation.
   */
  async _loadClientTranslations(configContext = this) {
    configContext.clientTranslations = this.configOptions.clientTranslations;
    if (configContext.clientTranslations) {
      this.clientTranslations = configContext.clientTranslations;
      return;
    }
    const { nativeLanguage } = configContext;
    this.clientTranslations = configContext.clientTranslations = this.configOptions.clientTranslations = {};
    const rootTemplatesPath = this.fetchFromInstalledJHipster('languages/templates/');

    // Prepare and load en translation
    const translationFiles = await this.writeFiles({
      sections: clientI18nFiles,
      rootTemplatesPath,
      context: {
        ...configContext,
        lang: 'en',
        clientSrcDir: '__tmp__',
      },
    });

    // Prepare and load native translation
    configContext.lang = configContext.nativeLanguage;
    if (nativeLanguage && nativeLanguage !== 'en') {
      translationFiles.push(
        ...(await this.writeFiles({
          sections: clientI18nFiles,
          rootTemplatesPath,
          context: {
            ...configContext,
            lang: configContext.nativeLanguage,
            clientSrcDir: '__tmp__',
          },
        }))
      );
    }
    for (const translationFile of translationFiles) {
      _.merge(this.clientTranslations, this.readDestinationJSON(translationFile));
      delete this.env.sharedFs.get(translationFile).state;
    }
  }

  /**
   * @experimental
   * Get translation value for a key.
   *
   * @param translationKey {string} - key to be translated
   * @param [data] {object} - template data in case translated value is a template
   */
  _getClientTranslation(translationKey, data) {
    let translatedValue = _.get(this.clientTranslations, translationKey);
    if (translatedValue === undefined) {
      const [last, second, ...others] = translationKey.split('.').reverse();
      translatedValue = _.get(this.clientTranslations, `${others.reverse().join('.')}['${second}.${last}']`);
    }
    if (translatedValue === undefined) {
      return `Translation missing for ${translationKey}`;
    }
    if (!data) {
      return translatedValue;
    }
    const compiledTemplate = _.template(translatedValue, { interpolate: /{{([\s\S]+?)}}/g });
    return compiledTemplate(data);
  }
};
