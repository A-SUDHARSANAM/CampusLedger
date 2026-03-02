import React from 'react';
import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="not-found">
      <div>
        <h1>404</h1>
        <p>Oops! Page not found</p>
        <Link to="/">Return to Home</Link>
      </div>
    </div>
  );
}
