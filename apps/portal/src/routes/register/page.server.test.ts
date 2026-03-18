import { describe, it, expect, vi, beforeEach } from 'vitest';
import { actions } from './+page.server.js';

// Mock the obp_requests module
vi.mock('$lib/obp/requests', () => ({
    obp_requests: {
        post: vi.fn()
    }
}));

import { obp_requests } from '$lib/obp/requests';

describe('Register page actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createMockRequest = (formData: Record<string, string>) => {
        const mockFormData = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
            mockFormData.append(key, value);
        });

        return {
            formData: () => Promise.resolve(mockFormData)
        };
    };

    const createMockLocals = (hasToken = true) => ({
        session: {
            data: {
                oauth: hasToken ? { access_token: 'mock-token-123' } : null
            }
        }
    });

    const mockCookies = {
        set: vi.fn()
    };

    it('should successfully register a user with valid data', async () => {
        // Arrange
        const mockResponse = {
            user_id: 'user-123',
            username: 'testuser'
        };
        vi.mocked(obp_requests.post).mockResolvedValue(mockResponse);

        const request = createMockRequest({
            email: 'test@example.com',
            username: 'testuser',
            password: 'password123',
            first_name: 'John',
            last_name: 'Doe'
        });

        // Act
        const result = await actions.default({
            request,
            locals: createMockLocals(),
            cookies: mockCookies
        });

        // Assert
        expect(obp_requests.post).toHaveBeenCalledWith(
            '/obp/v5.1.0/users',
            'mock-token-123',
            {
                email: 'test@example.com',
                username: 'testuser',
                password: 'password123',
                first_name: 'John',
                last_name: 'Doe'
            }
        );
        expect(result).toBeUndefined();
    });

    it('should return error when no access token is found', async () => {
        // Arrange
        const request = createMockRequest({
            email: 'test@example.com',
            username: 'testuser',
            password: 'password123',
            first_name: 'John',
            last_name: 'Doe'
        });

        // Act
        const result = await actions.default({
            request,
            locals: createMockLocals(false),
            cookies: mockCookies
        });

        // Assert
        expect(result).toEqual({
            error: "No access token found in session."
        });
        expect(obp_requests.post).not.toHaveBeenCalled();
    });

    it('should return error when OBP request fails', async () => {
        // Arrange
        vi.mocked(obp_requests.post).mockRejectedValue(new Error('API Error'));

        const request = createMockRequest({
            email: 'test@example.com',
            username: 'testuser',
            password: 'password123',
            first_name: 'John',
            last_name: 'Doe'
        });

        // Act
        const result = await actions.default({
            request,
            locals: createMockLocals(),
            cookies: mockCookies
        });

        // Assert
        expect(result).toEqual({
            error: "Failed to create consumer"
        });
        expect(obp_requests.post).toHaveBeenCalled();
    });

    it('should handle form data with correct types', async () => {
        // Arrange
        vi.mocked(obp_requests.post).mockResolvedValue({ success: true });

        const request = createMockRequest({
            email: 'user@domain.com',
            username: 'newuser',
            password: 'securepass',
            first_name: 'Jane',
            last_name: 'Smith'
        });

        // Act
        await actions.default({
            request,
            locals: createMockLocals(),
            cookies: mockCookies
        });

        // Assert
        const [endpoint, token, requestBody] = vi.mocked(obp_requests.post).mock.calls[0];
        
        expect(endpoint).toBe('/obp/v5.1.0/users');
        expect(token).toBe('mock-token-123');
        expect(requestBody).toEqual({
            email: 'user@domain.com',
            username: 'newuser',
            password: 'securepass',
            first_name: 'Jane',
            last_name: 'Smith'
        });
    });
});