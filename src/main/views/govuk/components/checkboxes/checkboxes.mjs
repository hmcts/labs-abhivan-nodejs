import { Component } from '../../component.mjs';
import { ElementError } from '../../errors/index.mjs';

/**
 * Checkboxes component
 *
 * @preserve
 */
class Checkboxes extends Component {
  /**
   * Checkboxes can be associated with a 'conditionally revealed' content block
   * – for example, a checkbox for 'Phone' could reveal an additional form field
   * for the user to enter their phone number.
   *
   * These associations are made using a `data-aria-controls` attribute, which
   * is promoted to an aria-controls attribute during initialisation.
   *
   * We also need to restore the state of any conditional reveals on the page
   * (for example if the user has navigated back), and set up event handlers to
   * keep the reveal in sync with the checkbox state.
   *
   * @param {Element | null} $root - HTML element to use for checkboxes
   */
  constructor($root) {
    super($root);
    this.$inputs = void 0;
    const $inputs = this.$root.querySelectorAll('input[type="checkbox"]');
    if (!$inputs.length) {
      throw new ElementError({
        component: Checkboxes,
        identifier: 'Form inputs (`<input type="checkbox">`)'
      });
    }
    this.$inputs = $inputs;
    this.$inputs.forEach($input => {
      const targetId = $input.getAttribute('data-aria-controls');
      if (!targetId) {
        return;
      }
      if (!document.getElementById(targetId)) {
        throw new ElementError({
          component: Checkboxes,
          identifier: `Conditional reveal (\`id="${targetId}"\`)`
        });
      }
      $input.setAttribute('aria-controls', targetId);
      $input.removeAttribute('data-aria-controls');
    });
    window.addEventListener('pageshow', () => this.syncAllConditionalReveals());
    this.syncAllConditionalReveals();
    this.$root.addEventListener('click', event => this.handleClick(event));
  }
  syncAllConditionalReveals() {
    this.$inputs.forEach($input => this.syncConditionalRevealWithInputState($input));
  }
  syncConditionalRevealWithInputState($input) {
    const targetId = $input.getAttribute('aria-controls');
    if (!targetId) {
      return;
    }
    const $target = document.getElementById(targetId);
    if ($target != null && $target.classList.contains('govuk-checkboxes__conditional')) {
      const inputIsChecked = $input.checked;
      $input.setAttribute('aria-expanded', inputIsChecked.toString());
      $target.classList.toggle('govuk-checkboxes__conditional--hidden', !inputIsChecked);
    }
  }
  unCheckAllInputsExcept($input) {
    const allInputsWithSameName = document.querySelectorAll(`input[type="checkbox"][name="${$input.name}"]`);
    allInputsWithSameName.forEach($inputWithSameName => {
      const hasSameFormOwner = $input.form === $inputWithSameName.form;
      if (hasSameFormOwner && $inputWithSameName !== $input) {
        $inputWithSameName.checked = false;
        this.syncConditionalRevealWithInputState($inputWithSameName);
      }
    });
  }
  unCheckExclusiveInputs($input) {
    const allInputsWithSameNameAndExclusiveBehaviour = document.querySelectorAll(`input[data-behaviour="exclusive"][type="checkbox"][name="${$input.name}"]`);
    allInputsWithSameNameAndExclusiveBehaviour.forEach($exclusiveInput => {
      const hasSameFormOwner = $input.form === $exclusiveInput.form;
      if (hasSameFormOwner) {
        $exclusiveInput.checked = false;
        this.syncConditionalRevealWithInputState($exclusiveInput);
      }
    });
  }
  handleClick(event) {
    const $clickedInput = event.target;
    if (!($clickedInput instanceof HTMLInputElement) || $clickedInput.type !== 'checkbox') {
      return;
    }
    const hasAriaControls = $clickedInput.getAttribute('aria-controls');
    if (hasAriaControls) {
      this.syncConditionalRevealWithInputState($clickedInput);
    }
    if (!$clickedInput.checked) {
      return;
    }
    const hasBehaviourExclusive = $clickedInput.getAttribute('data-behaviour') === 'exclusive';
    if (hasBehaviourExclusive) {
      this.unCheckAllInputsExcept($clickedInput);
    } else {
      this.unCheckExclusiveInputs($clickedInput);
    }
  }
}
Checkboxes.moduleName = 'govuk-checkboxes';

export { Checkboxes };
//# sourceMappingURL=checkboxes.mjs.map
