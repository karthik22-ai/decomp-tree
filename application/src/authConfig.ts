/**
 * authConfig.ts
 * 
 * Configuration for MSAL (Microsoft Authentication Library).
 * Needed to get tokens for the Fabric REST API.
 */

export const msalConfig = {
    auth: {
        clientId: import.meta.env.VITE_AZURE_CLIENT_ID || '00000000-0000-0000-0000-000000000000',
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || 'common'}`,
        redirectUri: window.location.origin,
    },
    cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
    }
};

// Scopes for Fabric REST API
export const loginRequest = {
    scopes: ['https://api.fabric.microsoft.com/.default']
};
