// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/**
 * Simple user profile class.
 */
class UserProfile {
    constructor(name, role) {
        this.name = name || undefined;
        this.role = role || undefined;

    }
};

exports.UserProfile = UserProfile;
