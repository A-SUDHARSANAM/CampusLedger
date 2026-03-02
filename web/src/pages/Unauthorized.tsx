import React from 'react';
import { Link } from 'react-router-dom';

export function Unauthorized() {
  return (
    <div className="not-found">
      <div>
        <h1>403</h1>
        <p>Unauthorized access</p>
        <Link to="/login">Go to Login</Link>
      </div>
    </div>
  );
}
