function isInitialised($root, moduleName) {
  return $root instanceof HTMLElement && $root.hasAttribute(`data-${moduleName}-init`);
}

/**
 * Checks if GOV.UK Frontend is supported on this page
 *
 * Some browsers will load and run our JavaScript but GOV.UK Frontend
 * won't be supported.
 *
 * @param {HTMLElement | null} [$scope] - (internal) `<body>` HTML element checked for browser support
 * @returns {boolean} Whether GOV.UK Frontend is supported on this page
 */
function isSupported($scope = document.body) {
  if (!$scope) {
    return false;
  }
  return $scope.classList.contains('govuk-frontend-supported');
}
function isArray(option) {
  return Array.isArray(option);
}
function isObject(option) {
  return !!option && typeof option === 'object' && !isArray(option);
}
function formatErrorMessage(Component, message) {
  return `${Component.moduleName}: ${message}`;
}
/**
 * @typedef ComponentWithModuleName
 * @property {string} moduleName - Name of the component
 */
/**
 * @import { ObjectNested } from './configuration.mjs'
 */

class GOVUKFrontendError extends Error {
  constructor(...args) {
    super(...args);
    this.name = 'GOVUKFrontendError';
  }
}
class SupportError extends GOVUKFrontendError {
  /**
   * Checks if GOV.UK Frontend is supported on this page
   *
   * @param {HTMLElement | null} [$scope] - HTML element `<body>` checked for browser support
   */
  constructor($scope = document.body) {
    const supportMessage = 'noModule' in HTMLScriptElement.prototype ? 'GOV.UK Frontend initialised without `<body class="govuk-frontend-supported">` from template `<script>` snippet' : 'GOV.UK Frontend is not supported in this browser';
    super($scope ? supportMessage : 'GOV.UK Frontend initialised without `<script type="module">`');
    this.name = 'SupportError';
  }
}
class ConfigError extends GOVUKFrontendError {
  constructor(...args) {
    super(...args);
    this.name = 'ConfigError';
  }
}
class ElementError extends GOVUKFrontendError {
  constructor(messageOrOptions) {
    let message = typeof messageOrOptions === 'string' ? messageOrOptions : '';
    if (typeof messageOrOptions === 'object') {
      const {
        component,
        identifier,
        element,
        expectedType
      } = messageOrOptions;
      message = identifier;
      message += element ? ` is not of type ${expectedType != null ? expectedType : 'HTMLElement'}` : ' not found';
      message = formatErrorMessage(component, message);
    }
    super(message);
    this.name = 'ElementError';
  }
}
class InitError extends GOVUKFrontendError {
  constructor(componentOrMessage) {
    const message = typeof componentOrMessage === 'string' ? componentOrMessage : formatErrorMessage(componentOrMessage, `Root element (\`$root\`) already initialised`);
    super(message);
    this.name = 'InitError';
  }
}
/**
 * @import { ComponentWithModuleName } from '../common/index.mjs'
 */

class Component {
  /**
   * Returns the root element of the component
   *
   * @protected
   * @returns {RootElementType} - the root element of component
   */
  get $root() {
    return this._$root;
  }
  constructor($root) {
    this._$root = void 0;
    const childConstructor = this.constructor;
    if (typeof childConstructor.moduleName !== 'string') {
      throw new InitError(`\`moduleName\` not defined in component`);
    }
    if (!($root instanceof childConstructor.elementType)) {
      throw new ElementError({
        element: $root,
        component: childConstructor,
        identifier: 'Root element (`$root`)',
        expectedType: childConstructor.elementType.name
      });
    } else {
      this._$root = $root;
    }
    childConstructor.checkSupport();
    this.checkInitialised();
    const moduleName = childConstructor.moduleName;
    this.$root.setAttribute(`data-${moduleName}-init`, '');
  }
  checkInitialised() {
    const constructor = this.constructor;
    const moduleName = constructor.moduleName;
    if (moduleName && isInitialised(this.$root, moduleName)) {
      throw new InitError(constructor);
    }
  }
  static checkSupport() {
    if (!isSupported()) {
      throw new SupportError();
    }
  }
}

/**
 * @typedef ChildClass
 * @property {string} moduleName - The module name that'll be looked for in the DOM when initialising the component
 */

/**
 * @typedef {typeof Component & ChildClass} ChildClassConstructor
 */
Component.elementType = HTMLElement;

const configOverride = Symbol.for('configOverride');
class ConfigurableComponent extends Component {
  [configOverride](param) {
    return {};
  }

  /**
   * Returns the root element of the component
   *
   * @protected
   * @returns {ConfigurationType} - the root element of component
   */
  get config() {
    return this._config;
  }
  constructor($root, config) {
    super($root);
    this._config = void 0;
    const childConstructor = this.constructor;
    if (!isObject(childConstructor.defaults)) {
      throw new ConfigError(formatErrorMessage(childConstructor, 'Config passed as parameter into constructor but no defaults defined'));
    }
    const datasetConfig = normaliseDataset(childConstructor, this._$root.dataset);
    this._config = mergeConfigs(childConstructor.defaults, config != null ? config : {}, this[configOverride](datasetConfig), datasetConfig);
  }
}
function normaliseString(value, property) {
  const trimmedValue = value ? value.trim() : '';
  let output;
  let outputType = property == null ? void 0 : property.type;
  if (!outputType) {
    if (['true', 'false'].includes(trimmedValue)) {
      outputType = 'boolean';
    }
    if (trimmedValue.length > 0 && isFinite(Number(trimmedValue))) {
      outputType = 'number';
    }
  }
  switch (outputType) {
    case 'boolean':
      output = trimmedValue === 'true';
      break;
    case 'number':
      output = Number(trimmedValue);
      break;
    default:
      output = value;
  }
  return output;
}
function normaliseDataset(Component, dataset) {
  if (!isObject(Component.schema)) {
    throw new ConfigError(formatErrorMessage(Component, 'Config passed as parameter into constructor but no schema defined'));
  }
  const out = {};
  const entries = Object.entries(Component.schema.properties);
  for (const entry of entries) {
    const [namespace, property] = entry;
    const field = namespace.toString();
    if (field in dataset) {
      out[field] = normaliseString(dataset[field], property);
    }
    if ((property == null ? void 0 : property.type) === 'object') {
      out[field] = extractConfigByNamespace(Component.schema, dataset, namespace);
    }
  }
  return out;
}
function mergeConfigs(...configObjects) {
  const formattedConfigObject = {};
  for (const configObject of configObjects) {
    for (const key of Object.keys(configObject)) {
      const option = formattedConfigObject[key];
      const override = configObject[key];
      if (isObject(option) && isObject(override)) {
        formattedConfigObject[key] = mergeConfigs(option, override);
      } else {
        formattedConfigObject[key] = override;
      }
    }
  }
  return formattedConfigObject;
}
function extractConfigByNamespace(schema, dataset, namespace) {
  const property = schema.properties[namespace];
  if ((property == null ? void 0 : property.type) !== 'object') {
    return;
  }
  const newObject = {
    [namespace]: {}
  };
  for (const [key, value] of Object.entries(dataset)) {
    let current = newObject;
    const keyParts = key.split('.');
    for (const [index, name] of keyParts.entries()) {
      if (isObject(current)) {
        if (index < keyParts.length - 1) {
          if (!isObject(current[name])) {
            current[name] = {};
          }
          current = current[name];
        } else if (key !== namespace) {
          current[name] = normaliseString(value);
        }
      }
    }
  }
  return newObject[namespace];
}
/**
 * Schema for component config
 *
 * @template {Partial<Record<keyof ConfigurationType, unknown>>} ConfigurationType
 * @typedef {object} Schema
 * @property {Record<keyof ConfigurationType, SchemaProperty | undefined>} properties - Schema properties
 * @property {SchemaCondition<ConfigurationType>[]} [anyOf] - List of schema conditions
 */
/**
 * Schema property for component config
 *
 * @typedef {object} SchemaProperty
 * @property {'string' | 'boolean' | 'number' | 'object'} type - Property type
 */
/**
 * Schema condition for component config
 *
 * @template {Partial<Record<keyof ConfigurationType, unknown>>} ConfigurationType
 * @typedef {object} SchemaCondition
 * @property {(keyof ConfigurationType)[]} required - List of required config fields
 * @property {string} errorMessage - Error message when required config fields not provided
 */
/**
 * @template {Partial<Record<keyof ConfigurationType, unknown>>} [ConfigurationType=ObjectNested]
 * @typedef ChildClass
 * @property {string} moduleName - The module name that'll be looked for in the DOM when initialising the component
 * @property {Schema<ConfigurationType>} [schema] - The schema of the component configuration
 * @property {ConfigurationType} [defaults] - The default values of the configuration of the component
 */
/**
 * @template {Partial<Record<keyof ConfigurationType, unknown>>} [ConfigurationType=ObjectNested]
 * @typedef {typeof Component & ChildClass<ConfigurationType>} ChildClassConstructor<ConfigurationType>
 */

class I18n {
  constructor(translations = {}, config = {}) {
    var _config$locale;
    this.translations = void 0;
    this.locale = void 0;
    this.translations = translations;
    this.locale = (_config$locale = config.locale) != null ? _config$locale : document.documentElement.lang || 'en';
  }
  t(lookupKey, options) {
    if (!lookupKey) {
      throw new Error('i18n: lookup key missing');
    }
    let translation = this.translations[lookupKey];
    if (typeof (options == null ? void 0 : options.count) === 'number' && typeof translation === 'object') {
      const translationPluralForm = translation[this.getPluralSuffix(lookupKey, options.count)];
      if (translationPluralForm) {
        translation = translationPluralForm;
      }
    }
    if (typeof translation === 'string') {
      if (translation.match(/%{(.\S+)}/)) {
        if (!options) {
          throw new Error('i18n: cannot replace placeholders in string if no option data provided');
        }
        return this.replacePlaceholders(translation, options);
      }
      return translation;
    }
    return lookupKey;
  }
  replacePlaceholders(translationString, options) {
    const formatter = Intl.NumberFormat.supportedLocalesOf(this.locale).length ? new Intl.NumberFormat(this.locale) : undefined;
    return translationString.replace(/%{(.\S+)}/g, function (placeholderWithBraces, placeholderKey) {
      if (Object.prototype.hasOwnProperty.call(options, placeholderKey)) {
        const placeholderValue = options[placeholderKey];
        if (placeholderValue === false || typeof placeholderValue !== 'number' && typeof placeholderValue !== 'string') {
          return '';
        }
        if (typeof placeholderValue === 'number') {
          return formatter ? formatter.format(placeholderValue) : `${placeholderValue}`;
        }
        return placeholderValue;
      }
      throw new Error(`i18n: no data found to replace ${placeholderWithBraces} placeholder in string`);
    });
  }
  hasIntlPluralRulesSupport() {
    return Boolean('PluralRules' in window.Intl && Intl.PluralRules.supportedLocalesOf(this.locale).length);
  }
  getPluralSuffix(lookupKey, count) {
    count = Number(count);
    if (!isFinite(count)) {
      return 'other';
    }
    const translation = this.translations[lookupKey];
    const preferredForm = this.hasIntlPluralRulesSupport() ? new Intl.PluralRules(this.locale).select(count) : this.selectPluralFormUsingFallbackRules(count);
    if (typeof translation === 'object') {
      if (preferredForm in translation) {
        return preferredForm;
      } else if ('other' in translation) {
        console.warn(`i18n: Missing plural form ".${preferredForm}" for "${this.locale}" locale. Falling back to ".other".`);
        return 'other';
      }
    }
    throw new Error(`i18n: Plural form ".other" is required for "${this.locale}" locale`);
  }
  selectPluralFormUsingFallbackRules(count) {
    count = Math.abs(Math.floor(count));
    const ruleset = this.getPluralRulesForLocale();
    if (ruleset) {
      return I18n.pluralRules[ruleset](count);
    }
    return 'other';
  }
  getPluralRulesForLocale() {
    const localeShort = this.locale.split('-')[0];
    for (const pluralRule in I18n.pluralRulesMap) {
      const languages = I18n.pluralRulesMap[pluralRule];
      if (languages.includes(this.locale) || languages.includes(localeShort)) {
        return pluralRule;
      }
    }
  }
}
I18n.pluralRulesMap = {
  arabic: ['ar'],
  chinese: ['my', 'zh', 'id', 'ja', 'jv', 'ko', 'ms', 'th', 'vi'],
  french: ['hy', 'bn', 'fr', 'gu', 'hi', 'fa', 'pa', 'zu'],
  german: ['af', 'sq', 'az', 'eu', 'bg', 'ca', 'da', 'nl', 'en', 'et', 'fi', 'ka', 'de', 'el', 'hu', 'lb', 'no', 'so', 'sw', 'sv', 'ta', 'te', 'tr', 'ur'],
  irish: ['ga'],
  russian: ['ru', 'uk'],
  scottish: ['gd'],
  spanish: ['pt-PT', 'it', 'es'],
  welsh: ['cy']
};
I18n.pluralRules = {
  arabic(n) {
    if (n === 0) {
      return 'zero';
    }
    if (n === 1) {
      return 'one';
    }
    if (n === 2) {
      return 'two';
    }
    if (n % 100 >= 3 && n % 100 <= 10) {
      return 'few';
    }
    if (n % 100 >= 11 && n % 100 <= 99) {
      return 'many';
    }
    return 'other';
  },
  chinese() {
    return 'other';
  },
  french(n) {
    return n === 0 || n === 1 ? 'one' : 'other';
  },
  german(n) {
    return n === 1 ? 'one' : 'other';
  },
  irish(n) {
    if (n === 1) {
      return 'one';
    }
    if (n === 2) {
      return 'two';
    }
    if (n >= 3 && n <= 6) {
      return 'few';
    }
    if (n >= 7 && n <= 10) {
      return 'many';
    }
    return 'other';
  },
  russian(n) {
    const lastTwo = n % 100;
    const last = lastTwo % 10;
    if (last === 1 && lastTwo !== 11) {
      return 'one';
    }
    if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) {
      return 'few';
    }
    if (last === 0 || last >= 5 && last <= 9 || lastTwo >= 11 && lastTwo <= 14) {
      return 'many';
    }
    return 'other';
  },
  scottish(n) {
    if (n === 1 || n === 11) {
      return 'one';
    }
    if (n === 2 || n === 12) {
      return 'two';
    }
    if (n >= 3 && n <= 10 || n >= 13 && n <= 19) {
      return 'few';
    }
    return 'other';
  },
  spanish(n) {
    if (n === 1) {
      return 'one';
    }
    if (n % 1000000 === 0 && n !== 0) {
      return 'many';
    }
    return 'other';
  },
  welsh(n) {
    if (n === 0) {
      return 'zero';
    }
    if (n === 1) {
      return 'one';
    }
    if (n === 2) {
      return 'two';
    }
    if (n === 3) {
      return 'few';
    }
    if (n === 6) {
      return 'many';
    }
    return 'other';
  }
};

/**
 * Exit this page component
 *
 * @preserve
 * @augments ConfigurableComponent<ExitThisPageConfig>
 */
class ExitThisPage extends ConfigurableComponent {
  /**
   * @param {Element | null} $root - HTML element that wraps the Exit This Page button
   * @param {ExitThisPageConfig} [config] - Exit This Page config
   */
  constructor($root, config = {}) {
    super($root, config);
    this.i18n = void 0;
    this.$button = void 0;
    this.$skiplinkButton = null;
    this.$updateSpan = null;
    this.$indicatorContainer = null;
    this.$overlay = null;
    this.keypressCounter = 0;
    this.lastKeyWasModified = false;
    this.timeoutTime = 5000;
    this.keypressTimeoutId = null;
    this.timeoutMessageId = null;
    const $button = this.$root.querySelector('.govuk-exit-this-page__button');
    if (!($button instanceof HTMLAnchorElement)) {
      throw new ElementError({
        component: ExitThisPage,
        element: $button,
        expectedType: 'HTMLAnchorElement',
        identifier: 'Button (`.govuk-exit-this-page__button`)'
      });
    }
    this.i18n = new I18n(this.config.i18n);
    this.$button = $button;
    const $skiplinkButton = document.querySelector('.govuk-js-exit-this-page-skiplink');
    if ($skiplinkButton instanceof HTMLAnchorElement) {
      this.$skiplinkButton = $skiplinkButton;
    }
    this.buildIndicator();
    this.initUpdateSpan();
    this.initButtonClickHandler();
    if (!('govukFrontendExitThisPageKeypress' in document.body.dataset)) {
      document.addEventListener('keyup', this.handleKeypress.bind(this), true);
      document.body.dataset.govukFrontendExitThisPageKeypress = 'true';
    }
    window.addEventListener('pageshow', this.resetPage.bind(this));
  }
  initUpdateSpan() {
    this.$updateSpan = document.createElement('span');
    this.$updateSpan.setAttribute('role', 'status');
    this.$updateSpan.className = 'govuk-visually-hidden';
    this.$root.appendChild(this.$updateSpan);
  }
  initButtonClickHandler() {
    this.$button.addEventListener('click', this.handleClick.bind(this));
    if (this.$skiplinkButton) {
      this.$skiplinkButton.addEventListener('click', this.handleClick.bind(this));
    }
  }
  buildIndicator() {
    this.$indicatorContainer = document.createElement('div');
    this.$indicatorContainer.className = 'govuk-exit-this-page__indicator';
    this.$indicatorContainer.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i++) {
      const $indicator = document.createElement('div');
      $indicator.className = 'govuk-exit-this-page__indicator-light';
      this.$indicatorContainer.appendChild($indicator);
    }
    this.$button.appendChild(this.$indicatorContainer);
  }
  updateIndicator() {
    if (!this.$indicatorContainer) {
      return;
    }
    this.$indicatorContainer.classList.toggle('govuk-exit-this-page__indicator--visible', this.keypressCounter > 0);
    const $indicators = this.$indicatorContainer.querySelectorAll('.govuk-exit-this-page__indicator-light');
    $indicators.forEach(($indicator, index) => {
      $indicator.classList.toggle('govuk-exit-this-page__indicator-light--on', index < this.keypressCounter);
    });
  }
  exitPage() {
    if (!this.$updateSpan) {
      return;
    }
    this.$updateSpan.textContent = '';
    document.body.classList.add('govuk-exit-this-page-hide-content');
    this.$overlay = document.createElement('div');
    this.$overlay.className = 'govuk-exit-this-page-overlay';
    this.$overlay.setAttribute('role', 'alert');
    document.body.appendChild(this.$overlay);
    this.$overlay.textContent = this.i18n.t('activated');
    window.location.href = this.$button.href;
  }
  handleClick(event) {
    event.preventDefault();
    this.exitPage();
  }
  handleKeypress(event) {
    if (!this.$updateSpan) {
      return;
    }
    if (event.key === 'Shift' && !this.lastKeyWasModified) {
      this.keypressCounter += 1;
      this.updateIndicator();
      if (this.timeoutMessageId) {
        window.clearTimeout(this.timeoutMessageId);
        this.timeoutMessageId = null;
      }
      if (this.keypressCounter >= 3) {
        this.keypressCounter = 0;
        if (this.keypressTimeoutId) {
          window.clearTimeout(this.keypressTimeoutId);
          this.keypressTimeoutId = null;
        }
        this.exitPage();
      } else {
        if (this.keypressCounter === 1) {
          this.$updateSpan.textContent = this.i18n.t('pressTwoMoreTimes');
        } else {
          this.$updateSpan.textContent = this.i18n.t('pressOneMoreTime');
        }
      }
      this.setKeypressTimer();
    } else if (this.keypressTimeoutId) {
      this.resetKeypressTimer();
    }
    this.lastKeyWasModified = event.shiftKey;
  }
  setKeypressTimer() {
    if (this.keypressTimeoutId) {
      window.clearTimeout(this.keypressTimeoutId);
    }
    this.keypressTimeoutId = window.setTimeout(this.resetKeypressTimer.bind(this), this.timeoutTime);
  }
  resetKeypressTimer() {
    if (!this.$updateSpan) {
      return;
    }
    if (this.keypressTimeoutId) {
      window.clearTimeout(this.keypressTimeoutId);
      this.keypressTimeoutId = null;
    }
    const $updateSpan = this.$updateSpan;
    this.keypressCounter = 0;
    $updateSpan.textContent = this.i18n.t('timedOut');
    this.timeoutMessageId = window.setTimeout(() => {
      $updateSpan.textContent = '';
    }, this.timeoutTime);
    this.updateIndicator();
  }
  resetPage() {
    document.body.classList.remove('govuk-exit-this-page-hide-content');
    if (this.$overlay) {
      this.$overlay.remove();
      this.$overlay = null;
    }
    if (this.$updateSpan) {
      this.$updateSpan.setAttribute('role', 'status');
      this.$updateSpan.textContent = '';
    }
    this.updateIndicator();
    if (this.keypressTimeoutId) {
      window.clearTimeout(this.keypressTimeoutId);
    }
    if (this.timeoutMessageId) {
      window.clearTimeout(this.timeoutMessageId);
    }
  }
}

/**
 * Exit this Page config
 *
 * @see {@link ExitThisPage.defaults}
 * @typedef {object} ExitThisPageConfig
 * @property {ExitThisPageTranslations} [i18n=ExitThisPage.defaults.i18n] - Exit this page translations
 */

/**
 * Exit this Page translations
 *
 * @see {@link ExitThisPage.defaults.i18n}
 * @typedef {object} ExitThisPageTranslations
 *
 * Messages used by the component programatically inserted text, including
 * overlay text and screen reader announcements.
 * @property {string} [activated] - Screen reader announcement for when EtP
 *   keypress functionality has been successfully activated.
 * @property {string} [timedOut] - Screen reader announcement for when the EtP
 *   keypress functionality has timed out.
 * @property {string} [pressTwoMoreTimes] - Screen reader announcement informing
 *   the user they must press the activation key two more times.
 * @property {string} [pressOneMoreTime] - Screen reader announcement informing
 *   the user they must press the activation key one more time.
 */

/**
 * @import { Schema } from '../../common/configuration.mjs'
 */
ExitThisPage.moduleName = 'govuk-exit-this-page';
ExitThisPage.defaults = Object.freeze({
  i18n: {
    activated: 'Loading.',
    timedOut: 'Exit this page expired.',
    pressTwoMoreTimes: 'Shift, press 2 more times to exit.',
    pressOneMoreTime: 'Shift, press 1 more time to exit.'
  }
});
ExitThisPage.schema = Object.freeze({
  properties: {
    i18n: {
      type: 'object'
    }
  }
});

export { ExitThisPage };
//# sourceMappingURL=exit-this-page.bundle.mjs.map
