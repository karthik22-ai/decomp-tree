import { useState } from 'react';
// import { MemoryRouter } from 'react-router-dom';
import SimulationCanvas from './components/SimulationCanvas';
import { ProjectSelector } from './components/ProjectSelector';
import './index.css';

function App() {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => localStorage.getItem('lastProjectId'));
  const [isSampleMode, setIsSampleMode] = useState<boolean>(() => localStorage.getItem('isSampleMode') === 'true');

  const handleSelectProject = (projectId: string, isSample: boolean = false) => {
    setCurrentProjectId(projectId);
    setIsSampleMode(isSample);
    localStorage.setItem('lastProjectId', projectId);
    localStorage.setItem('isSampleMode', isSample ? 'true' : 'false');
  };

  const handleBackToProjects = () => {
    setCurrentProjectId(null);
    setIsSampleMode(false);
    localStorage.removeItem('lastProjectId');
    localStorage.removeItem('isSampleMode');
  };

  const handleExitSampleMode = () => {
    setIsSampleMode(false);
    localStorage.setItem('isSampleMode', 'false');
  };

  return (
    <div className="app-container">
      {currentProjectId ? (
        <SimulationCanvas
          projectId={currentProjectId}
          isSampleMode={isSampleMode}
          onBack={handleBackToProjects}
          onExitSampleMode={handleExitSampleMode}
        />
      ) : (
        <ProjectSelector onSelectProject={handleSelectProject} />
      )}
    </div>
  );
}

export default App;
