import React from 'react';
import ReactDOM from 'react-dom/client';

function Dashboard({ data }: { data: string[] }) {
  return (
    <>
      <h1> Dashboard </h1>
    </>
  );
}

const rootElement = document.getElementById('root');
const dashboardData: string[] = (window as any).dashboardData || [];
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<Dashboard data={dashboardData} />);
}

const exampleFunction = (param: any) => {
  console.log(param);
};