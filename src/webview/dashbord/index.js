import React from 'react';
import ReactDOM from 'react-dom/client';

function Dashboard({ data }) {
  return (
    <>
      <h1>Dashboard</h1>
    </>
  );
}

const rootElement = document.getElementById('root');
const dashboardData = window.dashboardData || [];
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<Dashboard data={dashboardData} />);
}

const exampleFunction = (param) => {
  console.log(param);
};
