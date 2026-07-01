from google import genai
from google.genai import types
from sqlalchemy.orm import Session
from app.config import settings
from app.models import Match
from app.services.stats_compiler import compile_match_analysis
import json

def analyze_match_with_ai(match_id: int, user_query: str, db: Session) -> str:
    """
    Usa o Gemini Flash para analisar a partida com base puramente nos dados estatísticos do banco.
    Se a chave do Gemini não for fornecida, utiliza um gerador de relatórios estatísticos local.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        return "Partida não encontrada para análise."

    # Compilar dados estatísticos reais
    stats = compile_match_analysis(match, db)
    
    # Compilar dados estatísticos avançados V1.1
    from app.services.value_scanner import compile_advanced_analysis
    advanced_data = None
    try:
        advanced_data = compile_advanced_analysis(match, db)
    except Exception as e:
        print(f"Erro ao compilar dados avançados para o chat: {e}")
    
    # Criar um contexto JSON estruturado com todos os fatos do jogo
    context_data = {
        "campeonato": match.league,
        "pais": match.country,
        "data": match.date.strftime("%d/%m/%Y %H:%M"),
        "time_casa": match.home_team.name,
        "time_visitante": match.away_team.name,
        "odds_mercado": {
            "casa": match.odd_home,
            "empate": match.odd_draw,
            "visitante": match.odd_away
        },
        "odds_justas_calculadas": {
            "casa": match.fair_home,
            "empate": match.fair_draw,
            "visitante": match.fair_away
        },
        "probabilidades_porcentagem": {
            "casa": f"{match.prob_home:.1%}" if match.prob_home else "0%",
            "empate": f"{match.prob_draw:.1%}" if match.prob_draw else "0%",
            "visitante": f"{match.prob_away:.1%}" if match.prob_away else "0%"
        },
        "edge_percentual": f"{match.edge_val:.1%}",
        "ev_percentual": f"{match.ev_val:.1%}",
        "score_confianca": f"{match.confidence_score}/100",
        "recomendacao_sistema": match.recommendation,
        "justificativa_sistema": match.explanation,
        "estatisticas_forma": {
            "mandante": {
                "jogos_analisados": stats.home_stats.games_played,
                "vitorias": stats.home_stats.wins,
                "empates": stats.home_stats.draws,
                "derrotas": stats.home_stats.losses,
                "media_gols_marcados": stats.home_stats.avg_goals_scored,
                "media_gols_sofridos": stats.home_stats.avg_goals_conceded,
                "sequencia_recente": stats.home_stats.recent_form_string,
                "forma_em_casa": stats.home_stats.home_or_away_form_string
            },
            "visitante": {
                "jogos_analisados": stats.away_stats.games_played,
                "vitorias": stats.away_stats.wins,
                "empates": stats.away_stats.draws,
                "derrotas": stats.away_stats.losses,
                "media_gols_marcados": stats.away_stats.avg_goals_scored,
                "media_gols_sofridos": stats.away_stats.avg_goals_conceded,
                "sequencia_recente": stats.away_stats.recent_form_string,
                "forma_fora": stats.away_stats.home_or_away_form_string
            }
        },
        "confronto_direto_h2h": {
            "total_jogos": stats.h2h_matches_played,
            "vitorias_mandante_atual": stats.h2h_home_wins,
            "empates": stats.h2h_draws,
            "vitorias_visitante_atual": stats.h2h_away_wins,
            "ultimos_placares": stats.h2h_history
        },
        "analise_avancada_mercados": {
            "breakdown_confianca": {
                "final": advanced_data.confidence_breakdown.final_score if advanced_data else match.confidence_score,
                "ataque": advanced_data.confidence_breakdown.attack if advanced_data else 70,
                "defesa": advanced_data.confidence_breakdown.defense if advanced_data else 70,
                "forma": advanced_data.confidence_breakdown.form if advanced_data else 70,
                "h2h": advanced_data.confidence_breakdown.h2h if advanced_data else 70,
                "volume": advanced_data.confidence_breakdown.volume if advanced_data else 70
            },
            "mercados_gols": [
                {
                    "mercado": m.market,
                    "probabilidade": f"{m.probabilidade:.1%}",
                    "odd_justa": m.odd_justa,
                    "odd_mercado": m.odd_mercado,
                    "edge": f"{m.edge:.1%}",
                    "recomendacao": m.recommendation
                } for m in advanced_data.goals_markets
            ] if advanced_data else [],
            "btts": [
                {
                    "mercado": m.market,
                    "probabilidade": f"{m.probabilidade:.1%}",
                    "odd_justa": m.odd_justa,
                    "odd_mercado": m.odd_mercado,
                    "edge": f"{m.edge:.1%}",
                    "recomendacao": m.recommendation
                } for m in advanced_data.btts_market
            ] if advanced_data else [],
            "lay_draw": {
                "probabilidade": f"{advanced_data.lay_draw.probabilidade:.1%}",
                "odd_justa": advanced_data.lay_draw.odd_justa,
                "odd_mercado": advanced_data.lay_draw.odd_mercado,
                "edge": f"{advanced_data.lay_draw.edge:.1%}",
                "recomendacao": advanced_data.lay_draw.recommendation,
                "oportunidade_alta": advanced_data.lay_draw.destacar
            } if advanced_data else {}
        }
    }

    # Se não houver chave de API, gera a análise estatística baseada em regras locais
    if not settings.GEMINI_API_KEY:
        return generate_local_statistical_report(context_data, user_query)

    # Inicializar o cliente Gemini usando a nova API google-genai
    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        
        system_instruction = (
            "Você é o assistente especialista em trading esportivo e estatística do Trade Scanner AI V1.1 Pro.\n"
            "Sua missão é responder à dúvida do usuário baseando-se RIGOROSAMENTE nos dados fornecidos no contexto (que inclui Poisson de gols, Ambos Marcam, Lay Draw, breakdown de confiança e médias).\n"
            "Diretrizes:\n"
            "1. Responda em Português do Brasil de forma clara, profissional e analítica.\n"
            "2. NUNCA invente números, estatísticas ou placares. Se uma informação não estiver no contexto, diga claramente que não possui esse dado.\n"
            "3. Explique detalhadamente as recomendações de gols (Over/Under) e Ambos Marcam, e se vale a pena fazer Lay Draw (Lay ao Empate) baseado no edge e probabilidade.\n"
            "4. Aponte os riscos defensivos e ofensivos com base nos ratings específicos de ataque e defesa fornecidos no breakdown de confiança.\n"
            "5. Diga por que o modelo chegou a essa conclusão (explicando as distorções modelo vs mercado)."
        )

        prompt = (
            f"Contexto do Jogo (JSON):\n{json.dumps(context_data, indent=2, ensure_ascii=False)}\n\n"
            f"Pergunta do Usuário: {user_query}\n\n"
            f"Análise estatística e resposta:"
        )

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.3,
            )
        )
        return response.text
    except Exception as e:
        print(f"Erro na chamada do Gemini API: {e}. Executando fallback local.")
        return generate_local_statistical_report(context_data, user_query)


def generate_local_statistical_report(data: dict, query: str) -> str:
    """
    Gera um relatório explicativo em texto analisando os dados estatísticos reais da partida.
    Usado quando a chave do Gemini não está disponível ou falha.
    """
    casa = data["time_casa"]
    fora = data["time_visitante"]
    rec = data["recomendacao_sistema"]
    edge = data["edge_percentual"]
    ev = data["ev_percentual"]
    conf = data["score_confianca"]
    
    sh = data["estatisticas_forma"]["mandante"]
    sa = data["estatisticas_forma"]["visitante"]
    h2h = data["confronto_direto_h2h"]

    # Gerar parágrafo inicial
    resposta = (
        f"🤖 **[Assistente Estatístico V1 - Modo Offline]**\n\n"
        f"Análise da partida entre **{casa}** e **{fora}** pelo campeonato **{data['campeonato']}**:\n\n"
        f"1. **Recomendação Matemática**: A recomendação calculada é **{rec}** com um Edge estatístico de **{edge}** "
        f"e um Valor Esperado (EV) de **{ev}**. O score de confiança estatística do modelo para esta entrada é de **{conf}**.\n\n"
        f"2. **Análise de Gols (xG Estimado)**:\n"
        f"   - **{casa}**: Média de {sh['media_gols_marcados']} gols marcados e {sh['media_gols_sofridos']} gols sofridos por partida. Forma recente: `{sh['sequencia_recente']}`. Forma recente em casa: `{sh['forma_em_casa']}`.\n"
        f"   - **{fora}**: Média de {sa['media_gols_marcados']} gols marcados e {sa['media_gols_sofridos']} gols sofridos por partida. Forma recente: `{sa['sequencia_recente']}`. Forma recente fora: `{sa['forma_fora']}`.\n\n"
        f"3. **Confronto Direto (H2H)**: Foram analisadas {h2h['total_jogos']} partidas históricas entre as equipes. "
        f"Vitórias do {casa}: {h2h['vitorias_mandante_atual']}, Empates: {h2h['empates']}, Vitórias do {fora}: {h2h['vitorias_visitante_atual']}.\n"
    )

    # Se a pergunta pedir riscos ou por que da recomendação
    query_lower = query.lower()
    if "risco" in query_lower or "perigo" in query_lower:
        resposta += (
            f"\n⚠️ **Riscos Identificados**:\n"
            f"- A média de gols sofridos do {casa} é de {sh['media_gols_sofridos']} por jogo, o que pode ameaçar a solidez defensiva.\n"
            f"- O time visitante ({fora}) marca em média {sa['media_gols_marcados']} gols fora de casa, mostrando perigo em contra-ataques.\n"
            f"- O nível de confiança está em {conf}, o que indica uma liquidez e base de dados "
            f"{'excelente' if int(conf.split('/')[0]) >= 85 else 'alta' if int(conf.split('/')[0]) >= 70 else 'média' if int(conf.split('/')[0]) >= 40 else 'baixa'}."
        )
    elif "por que" in query_lower or "why" in query_lower or "explic" in query_lower:
        resposta += (
            f"\n📈 **Justificativa Estatística**:\n"
            f"- A recomendação é `{rec}` porque a probabilidade calculada pelo modelo de Poisson para esse cenário é de "
            f"{data['probabilidades_porcentagem']['casa'] if 'HOME' in rec else data['probabilidades_porcentagem']['visitante'] if 'AWAY' in rec else data['probabilidades_porcentagem']['empate']}, "
            f"que convertida em odd justa equivale a "
            f"{data['odds_justas_calculadas']['casa'] if 'HOME' in rec else data['odds_justas_calculadas']['visitante'] if 'AWAY' in rec else data['odds_justas_calculadas']['empate']:.2f}.\n"
            f"- Como a odd do mercado está em "
            f"{data['odds_mercado']['casa'] if 'HOME' in rec else data['odds_mercado']['visitante'] if 'AWAY' in rec else data['odds_mercado']['empate']:.2f}, "
            f"temos uma distorção de preço favorável ao investidor (Edge de {edge})."
        )
    else:
        resposta += (
            f"\n💡 *Nota: A chave de API do Gemini não foi encontrada no arquivo de ambiente (.env). "
            f"Para habilitar respostas em linguagem natural avançadas com inteligência artificial, "
            f"configure a variável GEMINI_API_KEY no arquivo .env.*"
        )

    return resposta
