import React, { useState } from 'react';
import { Button, TextField, MenuItem } from '@material-ui/core';

const environments = ['dev', 'test', 'prod']

export const AccountVendingForm = () => {
    const [accountName, setAccountName] = useState('');
    const [environment, setEnvironment] = useState('');
    const [ownerEmail, setOwnerEmail] = useState('');

    const handleSubmit = async () => {
        const payload = {
            accountName,
            environment,
            ownerEmail
        };

        await fetch('/api/account-vending', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify(payload),
        });
        alert('Account request submitted!');
    };

    return (
        <form noValidate autoComplete='off'>
            <TextField
                label="Account Name"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                fullWidth
                margin="normal"
            />
            <TextField
                select
                label="Environment"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                fullWidth
                margin="normal"
            >
                {environments.map((env) => (
                    <MenuItem key={env} value={env}>
                        {env}
                    </MenuItem>
                ))}
            </TextField>
            <TextField
                label="Owner Email"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                fullWidth
                margin="normal"
            />
            <Button variant="contained" color="primary" onClick={handleSubmit}> Submit </Button>
        </form>
    );
};

