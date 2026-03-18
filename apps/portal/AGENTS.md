## Running the project

`npm run dev`

## Error Handling

When displaying error messages from the OBP-API, ALWAYS show the full, original error message returned by the API. Do NOT wrap, summarize, or create generic/fantasy error messages. The OBP-API returns specific error codes and messages that are important for debugging.

Example - CORRECT:
```typescript
if (e instanceof OBPRequestError) {
    return { error: e.message }; // Shows actual OBP error like "OBP-30001: User not found"
}
```

Example - INCORRECT:
```typescript
return { error: 'Could not fetch data. Please try again later.' }; // Generic/fantasy message
```

The `OBPRequestError` class contains the actual error message from the OBP-API. Always use `e.message` directly.

## Using ChromeDevTools

When the user asks for some UI/css changes to be made, use chrome devtools MCP server to implement the changes, assume that the dev server is already running and that you do not need to run it before hand.

### UI debugging opey chatbot

When debugging the chat app, you need to populate it with some messages by typing in the input field and pressing the send/enter button.

## Theming/CSS

ALWAYS use skeletonUI's Tailwind framework for setting colours and css for elements, do not use native Tailwind. If in doubt the colour variables would be in obp-theme.css

### Skeleton UI Information

#### Colors

The Skeleton color system.

Skeleton provides guardrails and utilities to help you craft your custom color system. This includes a number of colors, shades, and contrast values that work together seamlessly. Providing a visually appealing and accessible palette for each theme.

##### Color Palette

<Default />

Supports <u>all</u> Tailwind color utility classes using the following pattern.

```txt
{property}-{color}-{shade}
```

\| Key      | Accepted Values                                                                                                  |
\| -------- | ---------------------------------------------------------------------------------------------------------------- |
\| Property | `accent`, `bg`, `border`, `caret`, `decoration`, `divide`, `fill`, `outline`, `ring`, `shadow`, `stroke`, `text` |
\| Color    | `primary`, `secondary`, `tertiary`, `success`, `warning`, `error`, `surface`                                     |
\| Shade    | `50`, `100`, `200`, `300`, `400`, `500`, `600`, `700`, `800`, `900`, `950`                                       |

```html
<div class="bg-primary-500">...</div>
<div class="border border-secondary-600">...</div>
<svg class="fill-surface-950">...</svg>
```

***

##### Contrast Colors

Test the following with different themes and dark mode combinations.

```astro
---
import { SwatchBookIcon } from 'lucide-react';
---

<section class="space-y-8">
	<div class="grid grid-cols-3 gap-6">
		<!-- Standard Colors -->
		<div class="flex flex-col space-y-2">
			<p class="text-xs">Direct Use</p>
			<div class="badge justify-start bg-primary-500 text-primary-contrast-500">
				<SwatchBookIcon className="size-4" />
				<span>Primary</span>
			</div>
			<div class="badge justify-start bg-secondary-500 text-secondary-contrast-500">
				<SwatchBookIcon className="size-4" />
				<span>Secondary</span>
			</div>
			<div class="badge justify-start bg-tertiary-500 text-tertiary-contrast-500">
				<SwatchBookIcon className="size-4" />
				<span>Tertiary</span>
			</div>
		</div>
		<!-- Presets -->
		<div class="flex flex-col space-y-2">
			<p class="text-xs">Presets</p>
			<div class="badge justify-start preset-filled-primary-950-50">
				<SwatchBookIcon className="size-4" />
				<span>Primary</span>
			</div>
			<div class="badge justify-start preset-filled-secondary-950-50">
				<SwatchBookIcon className="size-4" />
				<span>Secondary</span>
			</div>
			<div class="badge justify-start preset-filled-tertiary-950-50">
				<SwatchBookIcon className="size-4" />
				<span>Tertiary</span>
			</div>
		</div>
		<!-- Preset + Pairings -->
		<div class="flex flex-col space-y-2">
			<p class="text-xs">Preset + Pairings</p>
			<div class="badge justify-start preset-filled-primary-50-950">
				<SwatchBookIcon className="size-4" />
				<span>Primary</span>
			</div>
			<div class="badge justify-start preset-filled-secondary-50-950">
				<SwatchBookIcon className="size-4" />
				<span>Secondary</span>
			</div>
			<div class="badge justify-start preset-filled-tertiary-50-950">
				<SwatchBookIcon className="size-4" />
				<span>Tertiary</span>
			</div>
		</div>
	</div>
</section>

```

Contrast color values are available for every shade in the color ramp. Use these to set accessible text color and icon fill values. You may also refer to the [Preset system](/docs/\[framework]/design/presets) for utility classes that automatically mix each color and contrast tone.

```txt
{property}-{color}-contrast-{shade}
```

***

##### Color Pairings

<Pairings />

Provides a condensed syntax for dual-tone color values, evenly balanced to swap between light and dark mode. Pairings are supported for all Tailwind utility color classes (`bg`, `border`, `fill`, etc).

```txt
{property}-{color}-{lightModeShade}-{darkModeShade}
```

```html
<div class="bg-surface-200-800">...</div>
<div class="border border-secondary-400-600">...</div>
<svg class="fill-secondary-50-950">...</svg>
```

### How Pairings Work

Color Pairing are enabled through the use of the CSS [light-dark](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark) function. This means instead of writing the standard light/dark syntax with Tailwind utilities:

```html
<div class="text-primary-300 dark:text-primary-700">...</div>
```

You can instead use a much more condensed syntax:

```html
<div class="text-primary-300-700">...</div>
```

This will then be implemented into your CSS bundle as follows:

```css
.text-primary-300-700 {
	color: light-dark(var(--color-primary-300), var(--color-primary-700));
}
```

Plus, as a benefit to using the CSS `light-dark()` function, this also enables use of Tailwind's [Color Scheme](https://tailwindcss.com/docs/color-scheme) utilities. Learn more about [using Color Scheme](/docs/guides/mode#color-scheme).

###### When to Use Pairings

Color Parings are useful for generating a hierarchy of visual layers, ranging from foreground to background elements. Each reuse the same color ramp, but invert the order when switching from light to dark mode.

<PairingsStack />

* We can use shade `950` for light mode and `50` from dark mode to represent our body text color.
* Then use shade `50` from light mode and `950` from dark mode to represent our app background.
* Use the static `500` shade for key branding elements, such as buttons or banners.
* Then reserve multiple layers between for elements such as cards, inputs, and more.

***

##### Transparency

All available Skeleton Colors and Color Pairings support Tailwind's color transparency syntax.

```html
<div class="bg-primary-500/25">Primary Color @ 25% transparency</div>
<div class="bg-surface-50-950/60">Surface Pairing 50/950 @ 60% transparency</div>
```

#### Presets

Canned styles for your interface elements.

Presets are pre-defined utility classes that allow you to quickly and easily style buttons, badges, cards, and more. They are implemented using a combination of Skeleton and Tailwind primitives. A number of presets are available out of the box, with guidelines provided for crafting your own.

##### Skeleton Presets

The following Presets are available to you when using Skeleton. Each comes with a shorthand neutral option.

```astro
---
const diagramCircle = 'preset-tonal w-8 aspect-square flex justify-center items-center rounded-full';
---

<div class="grid grid-cols-3 gap-10">
	<!-- Preset: Filled -->
	<div class="flex flex-col items-center gap-4">
		<button type="button" class="btn preset-filled-primary-500">Filled</button>
		<div class={diagramCircle}>1</div>
	</div>
	<!-- Preset: Tonal -->
	<div class="flex flex-col items-center gap-4">
		<button type="button" class="btn preset-tonal-primary">Tonal</button>
		<div class={diagramCircle}>2</div>
	</div>
	<!-- Preset: Outlined -->
	<div class="flex flex-col items-center gap-4">
		<button type="button" class="btn preset-outlined-primary-500">Outlined</button>
		<div class={diagramCircle}>3</div>
	</div>
</div>

```

1. **Filled** - a filled preset of the primary brand color.
2. **Tonal** - a tonal preset of the primary brand color.
3. **Outlined** - an outlined preset of the primary brand color.

###### Filled

Has a wide variety of use cases and automatically implements [contrast colors](/docs/design/colors#contrast-colors) automatically.

```txt
preset-filled
preset-filled-{color}-{lightModeShade}-{darkModeShade}
```

```astro
<div class="w-full grid grid-cols-2 lg:grid-cols-3 gap-2">
	{/* Neutral */}
	<button type="button" class="btn preset-filled">(neutral)</button>
	{/* Colors */}
	<button type="button" class="btn preset-filled-primary-950-50">950-50</button>
	<button type="button" class="btn preset-filled-primary-900-100">900-100</button>
	<button type="button" class="btn preset-filled-primary-800-200">800-200</button>
	<button type="button" class="btn preset-filled-primary-700-300">700-300</button>
	<button type="button" class="btn preset-filled-primary-600-400">600-400</button>
	<button type="button" class="btn preset-filled-primary-500">500</button>
	<button type="button" class="btn preset-filled-primary-400-600">400-600</button>
	<button type="button" class="btn preset-filled-primary-300-700">300-700</button>
	<button type="button" class="btn preset-filled-primary-200-800">200-800</button>
	<button type="button" class="btn preset-filled-primary-100-900">100-900</button>
	<button type="button" class="btn preset-filled-primary-50-950">50-950</button>
</div>

```

###### Tonal

Ideal for alerts and axillary buttons and actions.

```txt
preset-tonal
preset-tonal-{color}
```

```astro
<div class="w-full grid grid-cols-2 lg:grid-cols-4 gap-2">
	{/* Neutral */}
	<button type="button" class="btn preset-tonal">(neutral)</button>
	{/* Colors */}
	<button type="button" class="btn preset-tonal-primary">primary</button>
	<button type="button" class="btn preset-tonal-secondary">secondary</button>
	<button type="button" class="btn preset-tonal-tertiary">tertiary</button>
	<button type="button" class="btn preset-tonal-success">success</button>
	<button type="button" class="btn preset-tonal-warning">warning</button>
	<button type="button" class="btn preset-tonal-error">error</button>
	<button type="button" class="btn preset-tonal-surface">surface</button>
</div>

```

###### Outlined

Ideal when for minimal interfaces, such as a surrounding card.

```txt
preset-outlined
preset-outlined-{color}-{shade}-{shade}
```

```astro
<div class="grid w-full grid-cols-2 gap-2 lg:grid-cols-3">
	{/* Neutral */}
	<button type="button" class="btn preset-outlined">(neutral)</button>
	{/* Colors */}
	<button type="button" class="btn preset-outlined-primary-950-50">950-50</button>
	<button type="button" class="btn preset-outlined-primary-900-100">900-100</button>
	<button type="button" class="btn preset-outlined-primary-800-200">800-200</button>
	<button type="button" class="btn preset-outlined-primary-700-300">700-300</button>
	<button type="button" class="btn preset-outlined-primary-600-400">600-400</button>
	<button type="button" class="btn preset-outlined-primary-500">500</button>
	<button type="button" class="btn preset-outlined-primary-400-600">400-600</button>
	<button type="button" class="btn preset-outlined-primary-300-700">300-700</button>
	<button type="button" class="btn preset-outlined-primary-200-800">200-800</button>
	<button type="button" class="btn preset-outlined-primary-100-900">100-900</button>
	<button type="button" class="btn preset-outlined-primary-50-950">50-950</button>
</div>

```

***

##### User Generated

In a nutshell, Presets are a resuable combination of styles that mix Skeleton and Tailwind primitives. This means you can create as many combinations as you wish to help control the aesthetic of your application. All custom presets should be implemented in your application's global stylesheet. See our reference examples below.

```astro
---
const presets = [
	{
		label: 'Glass',
		class: 'preset-glass-primary',
	},
	{
		label: 'Elevated',
		class: 'preset-filled-surface-100-900 shadow-xl',
	},
	{
		label: 'Ghost',
		class: 'hover:preset-tonal',
	},
	{
		label: 'Gradient',
		class: 'preset-gradient-secondary-primary',
	},
];
const cell = 'flex flex-col items-center gap-4';
const diagramCircle = 'preset-tonal w-8 aspect-square flex justify-center items-center rounded-full';
---

<div class="grid grid-cols-2 md:grid-cols-4 gap-10">
	{
		presets.map((preset, index) => (
			<div class={cell}>
				<button type="button" class={`btn ${preset.class}`}>
					{preset.label}
				</button>
				<div class={diagramCircle}>{index + 1}</div>
			</div>
		))
	}
</div>

<style>
	/* TIP: In a real world project you would implement the following in your global stylesheet. */
	.preset-gradient-secondary-primary {
		background-image: linear-gradient(-45deg, var(--color-secondary-500), var(--color-primary-500));
		color: var(--color-primary-contrast-500);
	}
	.preset-glass-primary {
		background: color-mix(in oklab, var(--color-primary-500) 40%, transparent);
		box-shadow: 0 0px 30px color-mix(in oklab, var(--color-primary-500) 50%, transparent) inset;
		backdrop-filter: blur(16px);
	}
</style>

```

1. **Glass** - a custom preset using background transparency and backdrop blur.
2. **Elevated** - mixes a filled preset with a shadow.
3. **Ghost** - has no style by default, but shows a tonal preset on hover.
4. **Gradient** - a custom preset generated using Tailwind gradient primitives.

###### Pratical Examples

###### Input Presets

Use Presets to generate your own custom validation classes for inputs.

```astro
<div class="w-full max-w-[320px] grid grid-rows-3 gap-4">
	<input type="text" class="input" value="Default Input State!" />
	<input type="text" class="input preset-input-success" value="Valid Input State!" />
	<input type="text" class="input preset-input-error" value="Invalid Input State!" />
</div>

<style>
	/* Add each custom preset to your global stylesheet. */
	.preset-input-success {
		background-color: var(--color-success-100);
		color: var(--color-success-900);
	}
	.preset-input-error {
		background-color: var(--color-error-100);
		color: var(--color-error-900);
	}
</style>

```

###### Gradient Presets

Utilize [Tailwind Gradient](https://tailwindcss.com/docs/gradient-color-stops) utility classes to create fancy buttons or cards.

```astro
<div class="w-full space-y-4">
	<div class="grid grid-cols-3 gap-4">
		<button class="btn preset-gradient-one">Button</button>
		<button class="btn preset-gradient-two">Button</button>
		<button class="btn preset-gradient-three">Button</button>
	</div>
	<div class="grid grid-cols-3 gap-4 text-center">
		<div class="card p-4 preset-gradient-one">Card</div>
		<div class="card p-4 preset-gradient-two">Card</div>
		<div class="card p-4 preset-gradient-three">Card</div>
	</div>
</div>

<style>
	/* Create a custom preset in your global stylesheet */
	.preset-gradient-one {
		background-image: linear-gradient(45deg, var(--color-primary-500), var(--color-tertiary-500));
		color: var(--color-primary-contrast-500);
	}
	.preset-gradient-two {
		background-image: linear-gradient(45deg, var(--color-error-500), var(--color-warning-500));
		color: var(--color-error-contrast-500);
	}
	.preset-gradient-three {
		background-image: linear-gradient(45deg, var(--color-success-500), var(--color-warning-500));
		color: var(--color-success-contrast-500);
	}
</style>

```

###### Glass Presets

Fine tune your Presets with special effects, such as the [Tailwind Backdrop Blur](https://tailwindcss.com/docs/backdrop-filter-blur) for a glass-like effect.

```astro
---
const baseClasses = 'card p-4 text-white text-center flex justify-start items-center';
---

<div
	class="w-full space-y-4 bg-[url(https://picsum.photos/id/249/1024/1024)] bg-center bg-no-repeat bg-cover rounded-container flex justify-center items-center p-4"
>
	<div class="w-full grid grid-cols-1 gap-2">
		<div class:list={`${baseClasses} preset-glass-neutral`}>Neutral</div>
		<div class:list={`${baseClasses} preset-glass-primary`}>Primary</div>
		<div class:list={`${baseClasses} preset-glass-secondary`}>Secondary</div>
		<div class:list={`${baseClasses} preset-glass-tertiary`}>Tertiary</div>
		<div class:list={`${baseClasses} preset-glass-success`}>Success</div>
		<div class:list={`${baseClasses} preset-glass-warning`}>Warning</div>
		<div class:list={`${baseClasses} preset-glass-error`}>Error</div>
		<div class:list={`${baseClasses} preset-glass-surface`}>Surface</div>
	</div>
</div>

<style>
	/* Create a custom preset in your global stylesheet */
	.preset-glass-neutral {
		background: color-mix(in oklab, var(--color-surface-50-950) 30%, transparent);
		box-shadow: 0 0px 30px color-mix(in oklab, var(--color-surface-50-950) 30%, transparent) inset;
		backdrop-filter: blur(16px);
	}
	.preset-glass-primary {
		background: color-mix(in oklab, var(--color-primary-500) 40%, transparent);
		box-shadow: 0 0px 30px color-mix(in oklab, var(--color-primary-500) 50%, transparent) inset;
		backdrop-filter: blur(16px);
	}
	.preset-glass-secondary {
		background: color-mix(in oklab, var(--color-secondary-500) 40%, transparent);
		box-shadow: 0 0px 30px color-mix(in oklab, var(--color-secondary-500) 50%, transparent) inset;
		backdrop-filter: blur(16px);
	}
	.preset-glass-tertiary {
		background: color-mix(in oklab, var(--color-tertiary-500) 40%, transparent);
		box-shadow: 0 0px 30px color-mix(in oklab, var(--color-tertiary-500) 50%, transparent) inset;
		backdrop-filter: blur(16px);
	}
	.preset-glass-success {
		background: color-mix(in oklab, var(--color-success-500) 40%, transparent);
		box-shadow: 0 0px 30px color-mix(in oklab, var(--color-success-500) 50%, transparent) inset;
		backdrop-filter: blur(16px);
	}
	.preset-glass-warning {
		background: color-mix(in oklab, var(--color-warning-500) 40%, transparent);
		box-shadow: 0 0px 30px color-mix(in oklab, var(--color-warning-500) 50%, transparent) inset;
		backdrop-filter: blur(16px);
	}
	.preset-glass-error {
		background: color-mix(in oklab, var(--color-error-500) 40%, transparent);
		box-shadow: 0 0px 30px color-mix(in oklab, var(--color-error-500) 50%, transparent) inset;
		backdrop-filter: blur(16px);
	}
	.preset-glass-surface {
		background: color-mix(in oklab, var(--color-surface-500) 40%, transparent);
		box-shadow: 0 0px 30px color-mix(in oklab, var(--color-surface-500) 50%, transparent) inset;
		backdrop-filter: blur(16px);
	}
</style>

```

###### Guidelines

* When creating custom Presets, you're only limited by your imagination.
* Use any combination of Skeleton or Tailwind primitives to generate a Preset.
* Apply Presets to any relevant element, including: buttons, badges, chips, cards, inputs, and more.
* Use a set naming convention, such as `preset-{foo}-{bar}` to keep things standardized.
* Consider implementing Presets using Tailwind's [@utility directive](https://tailwindcss.com/docs/functions-and-directives#utility-directive) in your stylesheet.
* Abstrast Presets to a stylesheet or NPM package for shared used between projects.
* Use Presets to apply styling for your components via the `class` attribute.