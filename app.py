from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import requests
import os
import uuid
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from deep_translator import GoogleTranslator

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.urandom(24)
db = SQLAlchemy(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)
    sessions = db.relationship('Session', backref='user', lazy=True)

class Session(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    start_time = db.Column(db.DateTime, nullable=False, default=datetime.now)
    end_time = db.Column(db.DateTime)
    duration = db.Column(db.Integer)
    status = db.Column(db.String(20), default='active')
    words_analyzed = db.Column(db.Integer, default=0)
    new_terms = db.Column(db.Integer, default=0)
    questions_generated = db.Column(db.Integer, default=0)

class Transcript(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('session.id'))
    text = db.Column(db.Text, nullable=False)
    is_final = db.Column(db.Boolean, default=False)
    timestamp = db.Column(db.DateTime, default=datetime.now)

class Term(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('session.id'))
    term = db.Column(db.String(100), nullable=False)
    translation = db.Column(db.String(200))
    timestamp = db.Column(db.DateTime, default=datetime.now)

class Question(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('session.id'))
    question_text = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.now)

class Summary(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('session.id'))
    summary_text = db.Column(db.Text, nullable=False)
    generated_at = db.Column(db.DateTime, default=datetime.now)

with app.app_context():
    db.create_all()

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/')
def index():
    return render_template('index.html', current_user=current_user if current_user.is_authenticated else None)


@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'Missing data'}), 400
        
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'success': False, 'error': 'Missing data'}), 400
        
    user = User.query.filter_by(username=username).first()
    
    if user and check_password_hash(user.password, password):
        login_user(user)
        return jsonify({'success': True, 'username': user.username})
    return jsonify({'success': False, 'error': 'Invalid username or password'})

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'Missing data'}), 400
        
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'success': False, 'error': 'Missing data'}), 400
        
    if User.query.filter_by(username=username).first():
        return jsonify({'success': False, 'error': 'Username already exists'}), 400
    
    hashed_password = generate_password_hash(password)
    
    new_user = User(username=username, password=hashed_password)
    db.session.add(new_user)
    db.session.commit()
    
    login_user(new_user)
    return jsonify({'success': True, 'username': new_user.username}), 201

@app.route('/api/start_session', methods=['POST'])
@login_required
def start_session():
    try:
        new_session = Session(
            user_id=current_user.id,
            start_time=datetime.now(),
            status='recording'
        )
        db.session.add(new_session)
        db.session.commit()
        return jsonify({
            'session_id': new_session.id,
            'message': 'Session started successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stop_session/<int:session_id>', methods=['POST'])
@login_required
def stop_session(session_id):
    session = Session.query.get(session_id)
    if not session or session.user_id != current_user.id:
        return jsonify({'error': 'Session not found or access denied'}), 404
    
    try:
        session.end_time = datetime.now()
        session.status = 'completed'
        session.duration = (session.end_time - session.start_time).seconds
        
        db.session.commit()
        return jsonify({
            'message': 'Session stopped successfully',
            'duration': session.duration
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/save_transcript', methods=['POST'])
@login_required
def save_transcript():
    data = request.json
    session_id = data.get('session_id')
    text = data.get('text')
    is_final = data.get('is_final', False)
    
    if not session_id or not text:
        return jsonify({'error': 'Missing data'}), 400
    
    session = Session.query.get(session_id)
    if not session or session.user_id != current_user.id:
        return jsonify({'error': 'Session not found or access denied'}), 404
    
    try:
        new_transcript = Transcript(
            session_id=session_id,
            text=text,
            is_final=is_final,
            timestamp=datetime.now()
        )
        db.session.add(new_transcript)
        words = len(text.split())
        session.words_analyzed = (session.words_analyzed or 0) + words
        db.session.commit()
        
        return jsonify({'message': 'Transcript saved successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/translate', methods=['POST'])
def translate_text():
    data = request.json
    text = data.get('text')
    target_lang = data.get('target_lang', 'ar')
    source_lang = data.get('source_lang', 'auto')
    
    if not text:
        return jsonify({'error': 'Missing data'}), 400
    
    try:
        translated_text = GoogleTranslator(source=source_lang, target=target_lang).translate(text)
        return jsonify({'translated_text': translated_text})
    except Exception as e:
        try:
            response = requests.post(
                'https://libretranslate.de/translate',
                json={
                    'q': text,
                    'source': source_lang,
                    'target': target_lang,
                    'format': 'text'
                }
            )
            if response.status_code == 200:
                translated_text = response.json().get('translatedText', '')
                return jsonify({'translated_text': translated_text})
            else:
                return jsonify({'error': 'Translation failed'}), 400
        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/api/save_term', methods=['POST'])
@login_required
def save_term():
    data = request.json
    session_id = data.get('session_id')
    term = data.get('term')
    translation = data.get('translation', '')
    
    if not session_id or not term:
        return jsonify({'error': 'Missing data'}), 400
    
    session = Session.query.get(session_id)
    if not session or session.user_id != current_user.id:
        return jsonify({'error': 'Session not found or access denied'}), 404
    
    try:
        new_term = Term(
            session_id=session_id,
            term=term,
            translation=translation,
            timestamp=datetime.now()
        )
        db.session.add(new_term)
        session.new_terms = (session.new_terms or 0) + 1
        db.session.commit()
        
        return jsonify({'message': 'Term saved successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/save_question', methods=['POST'])
@login_required
def save_question():
    data = request.json
    session_id = data.get('session_id')
    question_text = data.get('question_text')
    
    if not session_id or not question_text:
        return jsonify({'error': 'Missing data'}), 400
    
    session = Session.query.get(session_id)
    if not session or session.user_id != current_user.id:
        return jsonify({'error': 'Session not found or access denied'}), 404
    
    try:
        new_question = Question(
            session_id=session_id,
            question_text=question_text,
            timestamp=datetime.now()
        )
        db.session.add(new_question)
        session.questions_generated = (session.questions_generated or 0) + 1
        db.session.commit()
        
        return jsonify({'message': 'Question saved successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate_summary/<int:session_id>', methods=['GET'])
@login_required
def generate_summary(session_id):
    session = Session.query.get(session_id)
    if not session or session.user_id != current_user.id:
        return jsonify({'error': 'Session not found or access denied'}), 404
    
    try:
        transcripts = Transcript.query.filter_by(session_id=session_id, is_final=True).all()
        all_text = ' '.join([t.text for t in transcripts])
        
        summary_text = f"""
        <p>Learning session summary on {session.start_time.strftime('%Y-%m-%d')}</p>
        <p>Session duration: {session.duration // 60} minutes and {session.duration % 60} seconds</p>
        <p>Words analyzed: {session.words_analyzed}</p>
        <p>New technical terms: {session.new_terms}</p>
        <p>Questions generated: {session.questions_generated}</p>
        <p>Key discussed topics: {all_text[:200]}...</p>
        """
        
        new_summary = Summary(
            session_id=session_id,
            summary_text=summary_text,
            generated_at=datetime.now()
        )
        db.session.add(new_summary)
        db.session.commit()
        
        return jsonify({'summary': summary_text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/session_stats/<int:session_id>', methods=['GET'])
@login_required
def session_stats(session_id):
    session = Session.query.get(session_id)
    if not session or session.user_id != current_user.id:
        return jsonify({'error': 'Session not found or access denied'}), 404
    
    if session.status == 'recording':
        duration = (datetime.now() - session.start_time).seconds
    else:
        duration = session.duration or 0
    
    return jsonify({
        'duration': duration,
        'words_analyzed': session.words_analyzed or 0,
        'new_terms': session.new_terms or 0,
        'questions_generated': session.questions_generated or 0
    })


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)