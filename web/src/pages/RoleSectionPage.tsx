import React from 'react';

export function RoleSectionPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
