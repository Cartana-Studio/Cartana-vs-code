// Ensure the --jsx flag is set to react or react-jsx in your TypeScript or Babel configuration
import React, { useState, useEffect } from 'react';

const Dashboard = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    // Fetch data from VS Code API or mock data
    const fetchData = async () => {
      const mockData = [
        { id: 1, name: 'Project A', status: 'Active' },
        { id: 2, name: 'Project B', status: 'Inactive' },
        { id: 3, name: 'Project C', status: 'Pending' },
      ];
      setData(mockData);
    };

    fetchData();
  }, []);

  return ( 
    <>
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        
        <h1> Dashboard </h1>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>

          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>ID</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Name</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Status</th>
            </tr>
          </thead>

          <tbody>
            {data.map((item) => (
              <tr key={item.id}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.id}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.name}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.status}</td>
              </tr>
            ))}
          </tbody>

        </table>
      </div>
    </>

  );
};

export default Dashboard;
