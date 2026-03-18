import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import LoginPage from '$lib/../routes/login/+page.svelte';

describe('Login Page Component', () => {
	beforeEach(() => {
		// Clear any existing DOM content
		document.body.innerHTML = '';
	});

	afterEach(() => {
		// Clean up after each test
		document.body.innerHTML = '';
	});

	it('should render login page with title', () => {
		render(LoginPage);

		const title = screen.getByRole('heading', { name: /login/i });
		expect(title).toBeInTheDocument();
		expect(title).toHaveClass('h2');
	});

	it('should render login button with correct link', () => {
		render(LoginPage);

		const loginButton = screen.getByRole('button');
		expect(loginButton).toBeInTheDocument();
		expect(loginButton).toHaveClass('btn', 'preset-filled-primary-500');

		const loginLink = screen.getByRole('link', { name: /login with open bank project/i });
		expect(loginLink).toBeInTheDocument();
		expect(loginLink).toHaveAttribute('href', '/login/obp');
	});

	it('should have proper styling and layout', () => {
		render(LoginPage);

		const container = document.querySelector('.flex.h-full.w-full.items-center.justify-center');
		expect(container).toBeInTheDocument();

		const card = document.querySelector('.rounded-xl.mx-auto');
		expect(card).toBeInTheDocument();
		expect(card).toHaveClass(
			'rounded-xl',
			'mx-auto',
			'w-auto',
			'sm:w-sm',
			'md:w-lg',
			'h-xl',
			'bg-white/10',
			'p-4',
			'max-w-xl',
			'backdrop-blur-xs',
			'align-middle',
			'divide-primary-50-950',
			'divide-y'
		);
	});

	it('should center the login button', () => {
		render(LoginPage);

		const loginButton = screen.getByRole('button');
		expect(loginButton).toHaveClass('mx-auto', 'block');
	});

	it('should have responsive button width', () => {
		render(LoginPage);

		const loginButton = screen.getByRole('button');
		expect(loginButton).toHaveClass('w-full', 'sm:w-1/2');
	});

	it('should have proper button spacing', () => {
		render(LoginPage);

		const loginButton = screen.getByRole('button');
		expect(loginButton).toHaveClass('my-4');
	});

	it('should render accessible elements', () => {
		render(LoginPage);

		// Check that the title is properly structured as a heading
		const title = screen.getByRole('heading', { level: 1 });
		expect(title).toBeInTheDocument();

		// Check that the button is properly accessible
		const button = screen.getByRole('button');
		expect(button).toBeInTheDocument();

		// Check that the link is properly accessible
		const link = screen.getByRole('link');
		expect(link).toBeInTheDocument();
	});

	it('should have correct text content', () => {
		render(LoginPage);

		expect(screen.getByText('Login')).toBeInTheDocument();
		expect(screen.getByText('Login with Open Bank Project')).toBeInTheDocument();
	});

	it('should render button as a clickable element', async () => {
		const user = userEvent.setup();
		render(LoginPage);

		const button = screen.getByRole('button');

		// The button should be interactive
		expect(button).not.toBeDisabled();

		// We can't test the actual navigation since it's handled by SvelteKit,
		// but we can test that the button is clickable
		await user.click(button);

		// The button should still exist after clicking (no error thrown)
		expect(button).toBeInTheDocument();
	});

	it('should have proper semantic structure', () => {
		render(LoginPage);

		// Should have a main container
		const container = document.querySelector('.flex.h-full.w-full');
		expect(container).toBeInTheDocument();

		// Should have a card-like structure
		const card = container?.querySelector('.rounded-xl.mx-auto');
		expect(card).toBeInTheDocument();

		// Should have a heading inside the card
		const heading = card?.querySelector('h1');
		expect(heading).toBeInTheDocument();

		// Should have a button inside the card
		const button = card?.querySelector('button');
		expect(button).toBeInTheDocument();
	});

	it('should render with backdrop blur effect', () => {
		render(LoginPage);

		const card = document.querySelector('.backdrop-blur-xs');
		expect(card).toBeInTheDocument();
	});

	it('should have semi-transparent background', () => {
		render(LoginPage);

		const card = document.querySelector('.bg-white\\/10');
		expect(card).toBeInTheDocument();
	});

	it('should have divider styling', () => {
		render(LoginPage);

		const card = document.querySelector('.divide-primary-50-950.divide-y');
		expect(card).toBeInTheDocument();
	});

	it('should be responsive across different screen sizes', () => {
		render(LoginPage);

		// Check responsive width classes
		const card = document.querySelector('.w-auto.sm\\:w-sm.md\\:w-lg');
		expect(card).toBeInTheDocument();

		// Check responsive button width classes
		const button = screen.getByRole('button');
		expect(button).toHaveClass('w-full', 'sm:w-1/2');
	});

	it('should maintain proper contrast and accessibility', () => {
		render(LoginPage);

		// The text should be visible (not transparent or hidden)
		const title = screen.getByRole('heading');
		const computedStyle = window.getComputedStyle(title);
		expect(computedStyle.display).not.toBe('none');
		expect(computedStyle.visibility).not.toBe('hidden');

		// The button should be visible and interactive
		const button = screen.getByRole('button');
		const buttonStyle = window.getComputedStyle(button);
		expect(buttonStyle.display).not.toBe('none');
		expect(buttonStyle.visibility).not.toBe('hidden');
	});

	it('should have consistent spacing and layout', () => {
		render(LoginPage);

		// Check container spacing
		const container = document.querySelector('.flex.h-full.w-full.items-center.justify-center');
		expect(container).toBeInTheDocument();

		// Check card padding
		const card = document.querySelector('.p-4');
		expect(card).toBeInTheDocument();

		// Check button margin
		const button = screen.getByRole('button');
		expect(button).toHaveClass('my-4');
	});

	it('should render all required CSS classes', () => {
		render(LoginPage);

		// Test main container classes
		const mainContainer = document.querySelector('.flex.h-full.w-full.items-center.justify-center');
		expect(mainContainer).toBeInTheDocument();

		// Test card classes
		const cardClasses = [
			'rounded-xl',
			'mx-auto',
			'w-auto',
			'sm:w-sm',
			'md:w-lg',
			'h-xl',
			'bg-white/10',
			'p-4',
			'max-w-xl',
			'backdrop-blur-xs',
			'align-middle',
			'divide-primary-50-950',
			'divide-y'
		];

		const card = document.querySelector('.rounded-xl');
		cardClasses.forEach(className => {
			expect(card).toHaveClass(className);
		});

		// Test title classes
		const title = screen.getByRole('heading');
		expect(title).toHaveClass('h2', 'text-center');

		// Test button classes
		const button = screen.getByRole('button');
		const buttonClasses = [
			'btn',
			'preset-filled-primary-500',
			'mx-auto',
			'my-4',
			'block',
			'w-full',
			'sm:w-1/2'
		];

		buttonClasses.forEach(className => {
			expect(button).toHaveClass(className);
		});
	});
});
