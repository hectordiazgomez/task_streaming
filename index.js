import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { FaissStore } from "langchain/vectorstores/faiss";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { BufferMemory } from "langchain/memory";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { JSONLoader, JSONLinesLoader } from "langchain/document_loaders/fs/json";
import { PPTXLoader } from "langchain/document_loaders/fs/pptx";
import { DocxLoader } from "langchain/document_loaders/fs/docx";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { CSVLoader } from "langchain/document_loaders/fs/csv";
import express from 'express';
const app = express();


const predefinedQuestion = "Summarize the document";
const predefinedName = "documents";

const getPDFs = async (name) => {
    try {
        const directoryLoader = new DirectoryLoader(`./${name}`,
            {
                ".json": (path) => new JSONLoader(path),
                ".txt": (path) => new TextLoader(path),
                ".csv": (path) => new CSVLoader(path),
                ".pdf": (path) => new PDFLoader(path),
                ".docx": (path) => new DocxLoader(path),
                ".pptx": (path) => new PPTXLoader(path),
            }
        );

        const docs = await directoryLoader.load();

        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1500,
            chunkOverlap: 100,
            separators: ["\n"],
        });

        const splitDocs = await textSplitter.splitDocuments(docs);

        const embeddings = new OpenAIEmbeddings({
            //Your openai embeddings credentials go here
        });
        console.log("Embedded successfully")
        const vectorStore = await FaissStore.fromDocuments(splitDocs, embeddings);

        const llm = new ChatOpenAI({
          //Your chat openai credentials go here
          streaming: true,
        });
        const memory = new BufferMemory({ memoryKey: "chat_history", returnMessages: true });

        const conversationChain = ConversationalRetrievalQAChain.fromLLM(llm, vectorStore.asRetriever(), { memory });
        console.log('Documents are loaded...');

        return conversationChain;
    } catch (error) {
        console.error(error);
    }
}


async function askQuestion() {
    const question = predefinedQuestion;
    const name = predefinedName;

    if (!question) {
        console.error('Question is required');
        return;
    }
    try {
        const conversation = await getPDFs(name);
        let answer = "";
        await conversation?.invoke(
          { question },
          {
            callbacks: [
              {
                handleLLMNewToken(token) {
                  console.log(token);
                  answer += token;
                },
              },
            ],
          }
        );
        console.log({ answer });
    } catch (error) {
        console.error(error);
    }
}

askQuestion();

const PORT = 5000; 
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});