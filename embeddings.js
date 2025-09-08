import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

import dotenv from "dotenv";

dotenv.config();

const privateKey = process.env.SUPABASE_API_KEY;
const url = process.env.SUPABASE_URL;
const supabase = createClient(url, privateKey);

const rafaInfo = `Rafa started coding in 2019 when he decided to change careers and learn how to build applications. His journey began with a simple 'Hello World' and grew into a passion for creating impactful software.
Rafa is a fullstack engineer who enjoys building projects from scratch and exploring new technologies, driven by growth and innovation.
He loves solving complex problems, experimenting with new tools, and designing user experiences from start to finish.
Rafa is passionate about building responsive applications and crafting visually engaging designs.
He enjoys taking projects from initial concept all the way to final launch.
Although Rafa studied business management, he taught himself to code in order to create meaningful solutions.
His education includes Flatiron School (Full Stack Web Development, Houston, United States), a B.A. in Business Administration (UASLP, San Luis Potosí, Mexico), and a B.A. in International Business (UV, Valparaíso, Chile).
Hobbies: Tae Kwon Do, cooking, traveling, technology, video games, and video editing.
Some technologies Rafa has been working with recently include TypeScript, Angular, React, Node.js, and the OpenAI API.
Rafa’s favorite color is green.
Rafa’s favorite foods are tacos, pho, wings, and pozole.
Rafa loves traveling the world—he has been to many countries, so feel free to ask him where.
Rafa was born in Houston, Texas, raised in San Luis Potosí, Mexico, and later moved back to Houston.
Rafa is currently based in Houston, Texas.
Frontend: Angular, React, TypeScript, JavaScript, HTML5, CSS3, React Native, Redux, Styled Components, jQuery, Material-UI, Sass.
Backend: Node.js, C#, MongoDB, Neo4j, Microsoft .NET Framework, Microsoft SQL Server Manager, SQL.
Other: Amazon Web Services (AWS), Docker, Firebase, Git, Netlify, Expo.
Methodologies: Object-Oriented Programming (OOP), MVC, REST API, AJAX.
Rafa speaks English and Spanish (including several dialects).

Work Experience:

Sourcemap, New York City (Remote - Full Time) — Full Stack Developer (Jul 2023 – Jul 2025)
• Implemented Figma-based designs into performant, user-friendly, and accessible front-end applications.
• Developed and integrated RESTful APIs for maps, dashboards, tables, and interfaces to enable data-driven decision-making.
• Built extensive test suites with Jest, raising test coverage to 60% and reducing production bugs.
• Delivered urgent hotfixes for clients, minimizing downtime and maintaining satisfaction.
• Refactored legacy applications with 'fat model, thin controller' design, cutting technical debt by 60%.
• Integrated Mapbox.js and other services for supply chain visibility and intuitive data visualization.

Energy Ogre, Houston (Remote - Full Time) — Full Stack Developer (Jan 2021 – Jul 2023)
• Developed and maintained web, mobile, and internal apps using React, React Native, and .NET.
• Collaborated with engineers, analysts, and managers to deliver high-impact solutions.
• Led rebuilds of core applications for improved performance and maintainability.
• Worked with SQL databases: creating stored procedures, updating schemas, and managing tables.

Becoming You, Houston (Remote - Contract) — Front End Developer (May 2021 – Jul 2021)
• Built responsive landing pages in React for mobile and desktop optimization.
• Refactored and tested codebases for better performance and reliability.
• Designed scalable applications, integrating third-party services to enhance UX.

Rafa’s favorite countries to hike are Switzerland, Guatemala, and Colombia.`;

const singleText = [
  `Rafa started coding in 2019 when he decided to change careers and learn how to build applications. His journey began with a simple 'Hello World' and grew into a passion for creating impactful software.
Rafa is a fullstack engineer who enjoys building projects from scratch and exploring new technologies, driven by growth and innovation.
He loves solving complex problems, experimenting with new tools, and designing user experiences from start to finish.
Rafa is passionate about building responsive applications and crafting visually engaging designs.
He enjoys taking projects from initial concept all the way to final launch.
Although Rafa studied business management, he taught himself to code in order to create meaningful solutions.
His education includes Flatiron School (Full Stack Web Development, Houston, United States), a B.A. in Business Administration (UASLP, San Luis Potosí, Mexico), and a B.A. in International Business (UV, Valparaíso, Chile).
Hobbies: Tae Kwon Do, cooking, traveling, technology, video games, and video editing.
Some technologies Rafa has been working with recently include TypeScript, Angular, React, Node.js, and the OpenAI API.
Rafa’s favorite color is green.
Rafa’s favorite foods are tacos, pho, wings, and pozole.
Rafa loves traveling the world—he has been to many countries, so feel free to ask him where.
Rafa was born in Houston, Texas, raised in San Luis Potosí, Mexico, and later moved back to Houston.
Rafa is currently based in Houston, Texas.
Frontend: Angular, React, TypeScript, JavaScript, HTML5, CSS3, React Native, Redux, Styled Components, jQuery, Material-UI, Sass.
Backend: Node.js, C#, MongoDB, Neo4j, Microsoft .NET Framework, Microsoft SQL Server Manager, SQL.
Other: Amazon Web Services (AWS), Docker, Firebase, Git, Netlify, Expo.
Methodologies: Object-Oriented Programming (OOP), MVC, REST API, AJAX.
Rafa speaks English and Spanish (including several dialects).

Work Experience:

Sourcemap, New York City (Remote - Full Time) — Full Stack Developer (Jul 2023 – Jul 2025)
• Implemented Figma-based designs into performant, user-friendly, and accessible front-end applications.
• Developed and integrated RESTful APIs for maps, dashboards, tables, and interfaces to enable data-driven decision-making.
• Built extensive test suites with Jest, raising test coverage to 60% and reducing production bugs.
• Delivered urgent hotfixes for clients, minimizing downtime and maintaining satisfaction.
• Refactored legacy applications with 'fat model, thin controller' design, cutting technical debt by 60%.
• Integrated Mapbox.js and other services for supply chain visibility and intuitive data visualization.

Energy Ogre, Houston (Remote - Full Time) — Full Stack Developer (Jan 2021 – Jul 2023)
• Developed and maintained web, mobile, and internal apps using React, React Native, and .NET.
• Collaborated with engineers, analysts, and managers to deliver high-impact solutions.
• Led rebuilds of core applications for improved performance and maintainability.
• Worked with SQL databases: creating stored procedures, updating schemas, and managing tables.

Becoming You, Houston (Remote - Contract) — Front End Developer (May 2021 – Jul 2021)
• Built responsive landing pages in React for mobile and desktop optimization.
• Refactored and tested codebases for better performance and reliability.
• Designed scalable applications, integrating third-party services to enhance UX.

Rafa’s favorite countries to hike are Switzerland, Guatemala, and Colombia.`,
];

async function createAndStoreEmbeddings() {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const chunkData = await splitDocument();
  const data = await Promise.all(
    chunkData.map(async (chunk) => {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: chunk.pageContent,
      });
      return {
        content: chunk.pageContent,
        embedding: embeddingResponse.data[0].embedding,
      };
    })
  );
  await supabase.from("rafainfo").insert(data);
  console.log("SUCCESS!");
}

async function createAndStoreEmbeddingsONLY() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const data = await Promise.all(
    singleText.map(async (text) => {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: text,
      });
      return {
        content: text,
        embedding: embeddingResponse.data[0].embedding,
      };
    })
  );

  await supabase.from("rafainfo").insert(data);
  console.log("SUCCESS!");
}

// createAndStoreEmbeddingsONLY();

// createAndStoreEmbeddings();
