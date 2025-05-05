import './App.css';
// import './bvhSetup'; // This has the monkey-patching
import DXFViewer from './DXFViewer';
import { ConfigProvider } from 'antd';
import theme from './constants/theme';

function App() {
  return (
    <div className='App'>
      <ConfigProvider
        theme={theme}
      >
        <DXFViewer />
      </ConfigProvider>
    </div>
  );
}

export default App;
