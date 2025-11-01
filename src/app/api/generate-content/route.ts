import { NextRequest, NextResponse } from 'next/server';
import { contentTopics, getWeeklyContent, generateArticleContent, optimizeForSEO } from '@/lib/contentGenerator';
import { generateWeeklyContent, generateActualContent } from '@/lib/hybridContentSystem';
import { generateWeeklyAIContent, testAIGeneration } from '@/lib/aiContentGenerator';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

export const POST = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  try {
    const { mode = 'hybrid', forceGenerate = false } = await req.json();
    
    console.log('🤖 Starting intelligent content generation...');
    
    if (mode === 'ai' || mode === 'hybrid') {
      // Gebruik OpenAI voor intelligente content generatie
      console.log('🤖 Generating content with OpenAI...');
      const aiArticles = await generateWeeklyAIContent();
      
      return NextResponse.json({
        success: true,
        articles: aiArticles.map(article => ({
          ...article,
          publishDate: new Date().toISOString(),
          author: "WarmeLeads AI Expert Team",
          type: "ai_generated",
          dataSource: "openai_plus_market_data"
        })),
        mode: 'ai',
        message: `${aiArticles.length} AI-gegenereerde artikelen met actuele data`
      });
    }
    
    // Fallback naar template systeem
    const currentWeek = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    const weeklyTopics = getWeeklyContent(currentWeek);
    
    const generatedArticles = weeklyTopics.map(topic => {
      const baseContent = generateArticleContent(topic);
      const optimizedContent = optimizeForSEO(baseContent, topic);
      
      return {
        ...topic,
        content: optimizedContent,
        publishDate: new Date().toISOString(),
        author: "WarmeLeads Expert Team",
        readTime: Math.ceil(optimizedContent.length / 1000) + " min"
      };
    });

    return NextResponse.json({
      success: true,
      articles: generatedArticles,
      weekNumber: currentWeek,
      mode: 'template',
      message: `${generatedArticles.length} template artikelen gegenereerd`
    });

  } catch (error) {
    console.error('Content generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    );
  }
}, { adminOnly: true });

// Webhook voor automatische wekelijkse generatie (ADMIN ONLY)
export const GET = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  try {
    // Check if it's time for new content (every Monday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday
    
    if (dayOfWeek === 1) { // Monday
      // Generate this week's content
      const currentWeek = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
      const weeklyTopics = getWeeklyContent(currentWeek);
      
      // Here you would typically:
      // 1. Generate full articles using AI/templates
      // 2. Create new page files programmatically  
      // 3. Update blog index
      // 4. Trigger deployment
      
      return NextResponse.json({
        message: "Weekly content generation triggered",
        topics: weeklyTopics,
        scheduled: true
      });
    }

    return NextResponse.json({
      message: "Not time for content generation",
      nextGeneration: "Next Monday"
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Scheduler error' },
      { status: 500 }
    );
  }
}, { adminOnly: true });
