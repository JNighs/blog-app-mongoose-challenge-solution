'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

const expect = chai.expect;

const { BlogPost } = require('../models');
const { app, runServer, closeServer } = require('../server');
const { TEST_DATABASE_URL } = require('../config');

chai.use(chaiHttp);

function seedBlogPostData() {
    console.info('Seeding blog data');
    const blogData = [];

    for (let i = 1; i <= 10; i++) {
        blogData.push(generateBlogData());
    }

    return BlogPost.insertMany(blogData);
}

function generateTitle() {
    const titles = ['Title1', 'Title2', 'Title3', 'Title4', 'Title5']
    return titles[Math.floor(Math.random() * titles.length)];
}

function generateContent() {
    const content = ['Content1', 'Content2', 'Content3', 'Content4', 'Content5'];
    return content[Math.floor(Math.random() * content.length)];
}

function generateBlogData() {
    return {
        author: {
            firstName: faker.name.firstName(),
            lastName: faker.name.lastName()
        },
        title: generateTitle(),
        content: generateContent()
    };
}

function tearDownDb() {
    console.warn('Deleting database');
    return mongoose.connection.dropDatabase();
}

describe('BlogPosts API resource', function () {
    before(function () {
        return runServer(TEST_DATABASE_URL);
    });

    beforeEach(function () {
        return seedBlogPostData();
    });

    afterEach(function () {
        return tearDownDb();
    });

    after(function () {
        return closeServer();
    });

    describe('GET endpoint', function () {
        it('should return all existing blog posts', function () {
            let res;
            return chai.request(app)
                .get('/posts')
                .then(function (_res) {
                    res = _res;
                    expect(res).to.has.status(200);
                    expect(res.body).to.have.lengthOf.at.least(1);
                    return BlogPost.count();
                })
                .then(function (count) {
                    expect(res.body).to.have.lengthOf(count);
                });
        });

        it('should return blog posts with right fields', function () {
            let resBlogPost;
            return chai.request(app)
                .get('/posts')
                .then(function (res) {
                    expect(res).to.have.status(200);
                    expect(res).to.be.json;
                    expect(res.body).to.be.a('array');
                    expect(res.body).to.have.lengthOf.at.least(1);

                    res.body.forEach(function (post) {
                        expect(post).to.be.a('object');
                        expect(post).to.include.keys(
                            'author', 'title', 'content', 'created'
                        )
                    });
                    resBlogPost = res.body[0];
                    return BlogPost.findById(resBlogPost.id);
                })
                .then(function (post) {
                    expect(resBlogPost.id).to.equal(post.id);
                    expect(resBlogPost.author).to.equal(post.authorName);
                    expect(resBlogPost.title).to.equal(post.title);
                    expect(resBlogPost.content).to.equal(post.content);
                    //expect(resBlogPost.created).to.equal(post.created);
                });
        });
    });

    describe('POST endpoint', function () {
        it('should add a new blog post', function () {
            const newPost = generateBlogData();
            return chai.request(app)
                .post('/posts')
                .send(newPost)
                .then(function (res) {
                    expect(res).to.have.status(201);
                    expect(res).to.be.json;
                    expect(res.body).to.be.a('object');
                    expect(res.body).to.include.keys(
                        'author', 'title', 'content', 'created');
                    expect(res.body.author).to.equal(`${newPost.author.firstName} ${newPost.author.lastName}`);
                    expect(res.body.id).to.not.be.null;
                    expect(res.body.title).to.equal(newPost.title);
                    expect(res.body.content).to.equal(newPost.content);

                    return BlogPost.findById(res.body.id);
                })
                .then(function (post) {
                    expect(post.author).to.contain(newPost.author);
                    expect(post.title).to.equal(newPost.title);
                    expect(post.content).to.equal(newPost.content);
                    expect(post.created).to.exist;
                });
        });
    });

    describe('PUT endpoint', function () {
        it('should update fields you send over', function () {
            const updateData = {
                title: 'Updated Title',
                content: 'Updated Content'
            };

            return BlogPost
                .findOne()
                .then(function (post) {
                    updateData.id = post.id;
                    return chai.request(app)
                        .put(`/posts/${post.id}`)
                        .send(updateData);
                })
                .then(function (res) {
                    expect(res).to.have.status(204);
                    return BlogPost.findById(updateData.id);
                })
                .then(function (post) {
                    expect(post.title).to.equal(updateData.title);
                    expect(post.content).to.equal(updateData.content);
                });
        });
    });

    describe('DELETE endpoint', function () {
        it('delete a post by id', function () {
            let post;
            return BlogPost
                .findOne()
                .then(function (_post) {
                    post = _post;
                    return chai.request(app).delete(`/posts/${post.id}`);
                })
                .then(function (res) {
                    expect(res).to.have.status(204);
                    return BlogPost.findById(post.id);
                })
                .then(function (_post) {
                    expect(_post).to.be.null;
                });
        });
    });
});