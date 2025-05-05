import { useEffect } from 'react';
import axios from 'axios';

const fetchFilesData = (filesArray) => {
  useEffect(() => {
    // Define a function to fetch file data for a single object
    const fetchFileData = (file) => {
      const url = `/api/v1/mvporgsfiles/show?id=${file.id}&user_id=${
        getUser().id
      }&is_download_call&token=${getToken()}`;
      return axios.get(url);
    };

    // Create an array of promises for all file API requests
    const fetchAllFilesData = async () => {
      try {
        const promises = filesArray.map(fetchFileData); // Map through filesArray and create a promise for each API call
        const responses = await Promise.all(promises); // Wait for all promises to resolve
        const fileData = responses.map((response) => response.data); // Extract data from each response
      } catch (error) {
        console.error('Error fetching file data:', error);
      }
    };

    // Call the fetchAllFilesData function
    fetchAllFilesData();
  }, [filesArray]); // Dependency array includes filesArray
};

export { fetchFilesData };
